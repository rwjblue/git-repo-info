'use strict';

var fs   = require('fs');
var path = require('path');
var zlib = require('zlib');

var GIT_DIR = '.git';

function changeGitDir(newDirName) {
  GIT_DIR = newDirName;
}

function findRepoHandleLinkedWorktree(gitPath) {
  var stat = fs.statSync(gitPath);
  if (stat.isDirectory()) {
    return {
      // for the base (non-linked) dir, there is no distinction between where we
      // find the HEAD file and where we find the rest of .git
      worktreeGitDir: gitPath,
      commonGitDir: gitPath,
    };
  } else {
    var linkedGitDir = fs.readFileSync(gitPath).toString();
    var worktreeGitDir = /gitdir: (.*)/.exec(linkedGitDir)[1];
    var commonDirPath = path.join(worktreeGitDir, 'commondir');
    var commonDirRelative = fs.existsSync(commonDirPath) &&
                          fs.readFileSync(commonDirPath).toString().replace(/\r?\n$/, '');
    var commonDir = commonDirPath && path.resolve(path.join(worktreeGitDir, commonDirRelative));

    return {
      worktreeGitDir: path.resolve(worktreeGitDir),
      commonGitDir: commonDir,
    };
  }
}

function findRepo(startingPath) {
  var gitPath, lastPath;
  var currentPath = startingPath;

  if (!currentPath) { currentPath = process.cwd(); }

  do {
    gitPath = path.join(currentPath, GIT_DIR);

    if (fs.existsSync(gitPath)) {
      return findRepoHandleLinkedWorktree(gitPath);
    }

    lastPath = currentPath;
    currentPath = path.resolve(currentPath, '..');
  } while (lastPath !== currentPath);

  return null;
}

function findPackedTag(gitPath, refPath) {
  return getPackedRefsForType(gitPath, refPath, 'tag');
}

function findPackedCommit(gitPath, refPath) {
  return getPackedRefsForType(gitPath, refPath, 'commit');
}

function getPackedRefsForType(gitPath, refPath, type) {
  var packedRefsFilePath = path.join(gitPath, 'packed-refs');
  if (fs.existsSync(packedRefsFilePath)) {
    var packedRefsFile = fs.readFileSync(packedRefsFilePath, { encoding: 'utf8' });
    var shaLine = getLineForRefPath(packedRefsFile, type, refPath);

    if (shaLine) {
      return getShaBasedOnType(type, shaLine);
    }
  }
}

function getLineForRefPath(packedRefsFile, type, refPath) {
  return packedRefsFile.split('\n').filter(function(line) {
    return doesLineMatchRefPath(type, line, refPath);
  })[0];
}

function doesLineMatchRefPath(type, line, refPath) {
  var refPrefix = type === 'tag' ? 'refs/tags' : 'refs/heads';
  return line.indexOf(refPrefix) > -1 && line.indexOf(refPath) > -1;
}

function getShaBasedOnType(type, shaLine) {
  var shaResult = '';
  if (type === 'tag') {
    shaResult = shaLine.split('tags/')[1];
  } else if (type === 'commit') {
    shaResult = shaLine.split(' ')[0];
  }

  return shaResult;
}

function commitForTag(gitPath, tag) {
  var tagPath = path.join(gitPath, 'refs', 'tags', tag);
  var taggedObject = fs.readFileSync(tagPath, { encoding: 'utf8' }).trim();
  var objectPath = path.join(gitPath, 'objects', taggedObject.slice(0, 2), taggedObject.slice(2));

  if (!zlib.inflateSync || !fs.existsSync(objectPath)) {
    // we cannot support annotated tags on node v0.10 because
    // zlib does not allow sync access
    return taggedObject;
  }

  var objectContents = zlib.inflateSync(fs.readFileSync(objectPath)).toString();

  // 'tag 172\u0000object c1ee41c325d54f410b133e0018c7a6b1316f6cda\ntype commit\ntag awesome-tag\ntagger Robert Jackson
  // <robert.w.jackson@me.com> 1429100021 -0400\n\nI am making an annotated tag.\n'
  if (objectContents.slice(0,3) === 'tag') {
    var sections = objectContents.split(/\0|\n/);
    var sha = sections[1].slice(7);

    return sha;
  } else {
    // this will return the tag for lightweight tags
    return taggedObject;
  }
}

function findTag(gitPath, sha) {
  var tag = findPackedTag(gitPath, sha);
  if (tag) { return tag; }

  var tagsPath = path.join(gitPath, 'refs', 'tags');
  if (!fs.existsSync(tagsPath)) { return false; }

  var tags = fs.readdirSync(tagsPath);

  for (var i = 0, l = tags.length; i < l; i++) {
    tag = tags[i];
    var commitAtTag = commitForTag(gitPath, tags[i]);

    if (commitAtTag === sha) {
      return tag;
    }
  }
}

module.exports = function(gitPath) {
  var gitPathInfo = findRepo(gitPath);

  var result = {
    sha: null,
    abbreviatedSha: null,
    branch: null,
    tag: null,
    committer: null,
    committerDate: null,
    author: null,
    authorDate: null,
    commitMessage: null,
    root: null
  };

  if (!gitPathInfo) { return result; }

  try {
    result.root = path.resolve(gitPathInfo.commonGitDir, '..');

    var headFilePath   = path.join(gitPathInfo.worktreeGitDir, 'HEAD');

    if (fs.existsSync(headFilePath)) {
      var headFile = fs.readFileSync(headFilePath, {encoding: 'utf8'});
      var branchName = headFile.split('/').slice(2).join('/').trim();
      if (!branchName) {
        branchName = headFile.split('/').slice(-1)[0].trim();
      }
      var refPath = headFile.split(' ')[1];

      // Find branch and SHA
      if (refPath) {
        refPath = refPath.trim();
        var branchPath = path.join(gitPathInfo.commonGitDir, refPath);

        result.branch  = branchName;
        if (fs.existsSync(branchPath)) {
          result.sha = fs.readFileSync(branchPath, { encoding: 'utf8' }).trim();
        } else {
          result.sha = findPackedCommit(gitPathInfo.commonGitDir, refPath);
        }
      } else {
        result.sha = branchName;
      }

      result.abbreviatedSha = result.sha.slice(0,10);

      // Find commit data
      var commitData = getCommitData(gitPathInfo.commonGitDir, result.sha);
      if (commitData) {
        result = Object.keys(commitData).reduce(function(r, key) {
          result[key] = commitData[key];
          return result;
        }, result);
      }

      // Find tag
      var tag = findTag(gitPathInfo.commonGitDir, result.sha);
      if (tag) {
        result.tag = tag;
      }
    }
  } catch (e) {
    if (!module.exports._suppressErrors) {
      throw e; // helps with testing and scenarios where we do not expect errors
    } else {
      // eat the error
    }
  }

  return result;
};

module.exports._suppressErrors = true;
module.exports._findRepo     = findRepo;
module.exports._changeGitDir = changeGitDir;

function getCommitData(gitPath, sha) {
  var objectPath = path.join(gitPath, 'objects', sha.slice(0, 2), sha.slice(2));

  if (zlib.inflateSync && fs.existsSync(objectPath)) {
    var objectContents = zlib.inflateSync(fs.readFileSync(objectPath)).toString();

    return objectContents.split(/\0|\n/)
      .filter(function(item) {
        return !!item;
      })
      .reduce(function(data, section) {
        var part = section.slice(0, section.indexOf(' ')).trim();

        switch(part) {
          case 'commit':
          case 'tag':
          case 'object':
          case 'type':
          case 'tree':
          case 'parent':
            //ignore these for now
            break;
          case 'author':
          case 'committer':
            var parts = section.match(/^(?:author|committer)\s(.+)\s(\d+\s(?:\+|\-)\d{4})$/);

            if (parts) {
              data[part] = parts[1];
              data[part + 'Date'] = parseDate(parts[2]);
            }
            break;
          default:
            //should just be the commit message left
            data.commitMessage = section;
        }

        return data;
      }, {});
  }
}

function parseDate(d) {
  var epoch = d.split(' ')[0];
  return new Date(epoch * 1000).toISOString();
}
