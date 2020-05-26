'use strict';

var assert = require('assert');
var path = require('path');
var repoInfo = require('../index');
var zlib = require('zlib');

require('mocha-jshint')();

var root = process.cwd();
var testFixturesPath = path.join(__dirname, 'fixtures');
var gitDir = 'dot-git';

repoInfo._suppressErrors = false;

describe('git-repo-info', function() {
  before(function() {
    repoInfo._changeGitDir(gitDir);
  });

  afterEach(function() {
    process.chdir(root);
  });

  describe('repo lookup', function() {
    var repoRoot = path.join(testFixturesPath, 'nested-repo');

    it('finds a repo in the current directory', function() {
      process.chdir(repoRoot);

      var foundPathInfo = repoInfo._findRepo(repoRoot);
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
        root: repoRoot,
      });
    });

    it('finds a repo in the parent directory', function() {
      process.chdir(path.join(repoRoot, 'foo'));

      var foundPathInfo = repoInfo._findRepo(repoRoot);
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
        root: repoRoot,
      });
    });

    it('finds a repo 2 levels up', function() {
      process.chdir(path.join(repoRoot, 'foo', 'bar'));

      var foundPathInfo = repoInfo._findRepo(repoRoot);
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
        root: repoRoot,
      });
    });

    it('finds a repo without an argument', function() {
      process.chdir(repoRoot);

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
        root: repoRoot,
      });
    });

    it('finds a repo 2 levels up (without an argument)', function() {
      process.chdir(path.join(repoRoot, 'foo', 'bar'));

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
        root: repoRoot,
      });
    });

    it('finds a repo via a linked worktree', function() {
      var worktreeRoot = path.join(testFixturesPath, 'linked-worktree', 'linked');
      process.chdir(worktreeRoot);

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(testFixturesPath, 'linked-worktree', 'dot-git', 'worktrees', 'linked'),
        commonGitDir: path.join(testFixturesPath, 'linked-worktree', 'dot-git'),
        root: path.join(testFixturesPath, 'linked-worktree'),
      });
    });

    it('finds a repo via a submodule', function() {
      process.chdir(path.join(testFixturesPath, 'submodule', 'my-submodule'));

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules', 'my-submodule'),
        commonGitDir: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules', 'my-submodule'),
        root: path.join(testFixturesPath, 'submodule', 'my-submodule'),
      });
    });

    it('finds a repo via submodule on a specific path', function() {
        process.chdir(path.join(testFixturesPath, 'submodule'));

        var foundPathInfo = repoInfo._findRepo('my-submodule');
        assert.deepEqual(foundPathInfo, {
          worktreeGitDir: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules', 'my-submodule'),
          commonGitDir: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules', 'my-submodule'),
          root: path.join(testFixturesPath, 'submodule', 'my-submodule'),
        });
      });
  });

  describe('repoInfo', function() {
    it('returns an object with repo info', function() {
      var repoRoot = path.join(testFixturesPath, 'nested-repo');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'master',
        sha: '5359aabd3872d9ffd160712e9615c5592dfe6745',
        abbreviatedSha: '5359aabd38',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info including the parent tag', function() {
      var repoRoot = path.join(testFixturesPath, 'tag-on-parent');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'master',
        sha: 'fb26504da0ed5cd9ed366f7428c06a8433fd76e6',
        abbreviatedSha: 'fb26504da0',
        tag: null,
        committer: 'Lukas Kohler <lukas.kohler@ontheblueplanet.com>',
        committerDate: '2017-10-14T02:02:43.000Z',
        author: 'Lukas Kohler <lukas.kohler@ontheblueplanet.com>',
        authorDate: '2017-10-14T02:02:43.000Z',
        commitMessage: 'second commit without tag',
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        parents: [
          'e66f7ec2da3b5d06f0fe845c4fbc87247efacf62'
        ],
        lastTag: 'parent-magic-tag',
        commitsSinceLastTag: 1
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info including the parent tag before a merge commit', function() {
      var repoRoot = path.join(testFixturesPath, 'tag-on-parent-before-merge');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'master',
        sha: 'b60d665ae0978a7b46e2447f4c13d7909997f56c',
        abbreviatedSha: 'b60d665ae0',
        tag: null,
        committer: 'Lukas Kohler <lukas.kohler@ontheblueplanet.com>',
        committerDate: '2017-11-13T14:54:49.000Z',
        author: 'Lukas Kohler <lukas.kohler@ontheblueplanet.com>',
        authorDate: '2017-11-13T14:54:49.000Z',
        commitMessage: 'merge red and blue',
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        parents: [
          'b0c8b86ee451a2f389eed64838449d9a00a0b45f',
          '4f5c726a1528fdfb1ec7c9537e4b1b2dbaacbcc4'
        ],
        lastTag: 'magic-tag',
        commitsSinceLastTag: 1
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info', function() {
      var repoRoot = path.join(testFixturesPath, 'detached-head');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: null,
        sha: '9dac893d5a83c02344d91e79dad8904889aeacb1',
        abbreviatedSha: '9dac893d5a',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info (packed commit)', function() {
      var repoRoot = path.join(testFixturesPath, 'commit-packed');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'develop',
        sha: 'd670460b4b4aece5915caf5c68d12f560a9fe3e4',
        abbreviatedSha: 'd670460b4b',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info, including the tag (packed tags)', function() {
      var repoRoot = path.join(testFixturesPath, 'tagged-commit-packed');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'master',
        sha: '5359aabd3872d9ffd160712e9615c5592dfe6745',
        abbreviatedSha: '5359aabd38',
        tag: 'my-tag',
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: 'my-tag',
        commitsSinceLastTag: 0
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info, including the tag (packed annotated tag)', function() {
      var repoRoot = path.join(testFixturesPath, 'tagged-commit-packed-annotated');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'master',
        sha: '5359aabd3872d9ffd160712e9615c5592dfe6745',
        abbreviatedSha: '5359aabd38',
        tag: 'example-annotated-tag',
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: 'example-annotated-tag',
        commitsSinceLastTag: 0
      };

      assert.deepEqual(result, expected);
    });

    if (zlib.inflateSync) {
      it('returns an object with repo info, including the tag (unpacked tags)', function() {
        var repoRoot = path.join(testFixturesPath, 'tagged-commit-unpacked');
        var localGitDir = path.join(repoRoot, gitDir);
        var result = repoInfo(localGitDir);

        var expected = {
          branch: 'master',
          sha: 'c1ee41c325d54f410b133e0018c7a6b1316f6cda',
          abbreviatedSha: 'c1ee41c325',
          tag: 'awesome-tag',
          committer: 'Robert Jackson <robert.w.jackson@me.com>',
          committerDate: '2015-04-15T12:10:06.000Z',
          author: 'Robert Jackson <robert.w.jackson@me.com>',
          authorDate: '2015-04-15T12:10:06.000Z',
          commitMessage: 'Initial commit.',
          root: repoRoot,
          commonGitDir: localGitDir,
          worktreeGitDir: localGitDir,
          lastTag: 'awesome-tag',
          commitsSinceLastTag: 0
        };

        assert.deepEqual(result, expected);
      });
    } else {
      it('returns an object with repo info, including the tag (unpacked tags)', function() {
        var repoRoot = path.join(testFixturesPath, 'tagged-commit-unpacked');
        var localGitDir = path.join(repoRoot, gitDir);
        var result = repoInfo(localGitDir);

        var expected = {
          branch: 'master',
          sha: 'c1ee41c325d54f410b133e0018c7a6b1316f6cda',
          abbreviatedSha: 'c1ee41c325',
          tag: 'awesome-tag',
          committer: null,
          committerDate: null,
          author: null,
          authorDate: null,
          commitMessage: null,
          root: repoRoot,
          commonGitDir: localGitDir,
          worktreeGitDir: localGitDir,
          lastTag: 'awesome-tag',
          commitsSinceLastTag: 0
        };

        assert.deepEqual(result, expected);
      });
    }

    it('returns an object with repo info, including the tag (unpacked tags) when a tag object does not exist', function() {
      var repoRoot = path.join(testFixturesPath, 'tagged-commit-unpacked-no-object');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'master',
        sha: 'c1ee41c325d54f410b133e0018c7a6b1316f6cda',
        abbreviatedSha: 'c1ee41c325',
        tag: 'awesome-tag',
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: 'awesome-tag',
        commitsSinceLastTag: 0
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info, including the tag (deterministic alpha sort)', function() {
      var repoRoot = path.join(testFixturesPath, 'tagged-commit-mixed-packing');
      var result = repoInfo(path.join(repoRoot, gitDir));

      var expected = {
        sha: '37ece7ad9ded5f2312bb6be8d0c21ecebca088ac',
        tag: '0-lightweight-tag',
      };

      assert.deepEqual({ sha: result.sha, tag: result.tag }, expected);
    });

    if (zlib.inflateSync) {
      it('returns an object with repo info, including the tag (annotated tags)', function() {
        var repoRoot = path.join(testFixturesPath, 'tagged-annotated');
        var localGitDir = path.join(repoRoot, gitDir);
        var result = repoInfo(localGitDir);

        var expected = {
          branch: 'master',
          sha: 'c1ee41c325d54f410b133e0018c7a6b1316f6cda',
          abbreviatedSha: 'c1ee41c325',
          tag: 'awesome-tag',
          committer: 'Robert Jackson <robert.w.jackson@me.com>',
          committerDate: '2015-04-15T12:10:06.000Z',
          author: 'Robert Jackson <robert.w.jackson@me.com>',
          authorDate: '2015-04-15T12:10:06.000Z',
          commitMessage: 'Initial commit.',
          root: repoRoot,
          commonGitDir: localGitDir,
          worktreeGitDir: localGitDir,
          lastTag: 'awesome-tag',
          commitsSinceLastTag: 0
        };

        assert.deepEqual(result, expected);
      });
    }

    it('returns an object with repo info, including the full branch name, if the branch name includes any slashes', function() {
      var repoRoot = path.join(testFixturesPath, 'branch-with-slashes');
      var localGitDir = path.join(repoRoot, gitDir);
      var result = repoInfo(localGitDir);

      var expected = {
        branch: 'feature/branch/with/slashes',
        sha: '5359aabd3872d9ffd160712e9615c5592dfe6745',
        abbreviatedSha: '5359aabd38',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info for linked worktrees', function() {
      var repoRoot = path.join(testFixturesPath, 'linked-worktree');
      process.chdir(path.join(repoRoot, 'linked'));
      var result = repoInfo();

      var expected = {
        branch: null,
        sha: '409372f3bd07c11bfacee3963f48571d675268d7',
        abbreviatedSha: '409372f3bd',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: repoRoot,
        commonGitDir: path.join(repoRoot, gitDir),
        worktreeGitDir: path.join(repoRoot, gitDir, 'worktrees', 'linked'),
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object for repo info for submodules', function() {
      var parentRoot = path.join(testFixturesPath, 'submodule');
      var moduleRoot = path.join(parentRoot, 'my-submodule');
      var localGitDir = path.join(parentRoot, gitDir, 'modules', 'my-submodule');
      process.chdir(moduleRoot);
      var result = repoInfo();
      var expected = {
        branch: null,
        sha: '409372f3bd07c11bfacee3963f48571d675268d7',
        abbreviatedSha: '409372f3bd',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: moduleRoot,
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object for repo info for submodule on a specific path', function() {
      var parentRoot = path.join(testFixturesPath, 'submodule');
      var localGitDir = path.join(parentRoot, gitDir, 'modules', 'my-submodule');
      process.chdir(parentRoot);
      var result = repoInfo('my-submodule');

      var expected = {
        branch: null,
        sha: '409372f3bd07c11bfacee3963f48571d675268d7',
        abbreviatedSha: '409372f3bd',
        tag: null,
        committer: null,
        committerDate: null,
        author: null,
        authorDate: null,
        commitMessage: null,
        root: path.join(parentRoot, 'my-submodule'),
        commonGitDir: localGitDir,
        worktreeGitDir: localGitDir,
        lastTag: null,
        commitsSinceLastTag: Infinity
      };

      assert.deepEqual(result, expected);
    });
  });

  describe('repoInfo().root', function() {
    var repoRoot = path.join(testFixturesPath, 'nested-repo');

    it('finds a repo from cwd (2 levels up)', function() {
      process.chdir(path.join(repoRoot, 'foo', 'bar'));
      assert.equal(repoInfo().root, repoRoot);
    });

    it('finds a repo with an argument', function() {
      assert.equal(repoInfo(path.join(repoRoot, 'foo', 'bar')).root, repoRoot);
    });
  });
});
