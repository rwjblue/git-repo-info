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
      });
    });

    it('finds a repo in the parent directory', function() {
      process.chdir(path.join(repoRoot, 'foo'));

      var foundPathInfo = repoInfo._findRepo(repoRoot);
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
      });
    });

    it('finds a repo 2 levels up', function() {
      process.chdir(path.join(repoRoot, 'foo', 'bar'));

      var foundPathInfo = repoInfo._findRepo(repoRoot);
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
      });
    });

    it('finds a repo without an argument', function() {
      process.chdir(repoRoot);

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
      });
    });

    it('finds a repo 2 levels up (without an argument)', function() {
      process.chdir(path.join(repoRoot, 'foo', 'bar'));

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(repoRoot, gitDir),
        commonGitDir: path.join(repoRoot, gitDir),
      });
    });

    it('finds a repo via a linked worktree', function() {
      process.chdir(path.join(testFixturesPath, 'linked-worktree', 'linked'));

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(testFixturesPath, 'linked-worktree', 'dot-git', 'worktrees', 'linked'),
        commonGitDir: path.join(testFixturesPath, 'linked-worktree', 'dot-git'),
      });
    });

    it('finds a repo via a submodule', function() {
      process.chdir(path.join(testFixturesPath, 'submodule', 'my-submodule'));

      var foundPathInfo = repoInfo._findRepo();
      assert.deepEqual(foundPathInfo, {
        worktreeGitDir: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules', 'my-submodule'),
        commonGitDir: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules', 'my-submodule'),
      });
    });
  });

  describe('repoInfo', function() {
    it('returns an object with repo info', function() {
      var repoRoot = path.join(testFixturesPath, 'nested-repo');
      var result = repoInfo(path.join(repoRoot, gitDir));

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
        root: repoRoot
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info', function() {
      var repoRoot = path.join(testFixturesPath, 'detached-head');
      var result = repoInfo(path.join(repoRoot, gitDir));

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
        root: repoRoot
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info (packed commit)', function() {
      var repoRoot = path.join(testFixturesPath, 'commit-packed');
      var result = repoInfo(path.join(repoRoot, gitDir));

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
        root: repoRoot
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info, including the tag (packed tags)', function() {
      var repoRoot = path.join(testFixturesPath, 'tagged-commit-packed');
      var result = repoInfo(path.join(repoRoot, gitDir));

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
        root: repoRoot
      };

      assert.deepEqual(result, expected);
    });

    if (zlib.inflateSync) {
      it('returns an object with repo info, including the tag (unpacked tags)', function() {
        var repoRoot = path.join(testFixturesPath, 'tagged-commit-unpacked');
        var result = repoInfo(path.join(repoRoot, gitDir));

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
          root: repoRoot
        };

        assert.deepEqual(result, expected);
      });
    } else {
      it('returns an object with repo info, including the tag (unpacked tags)', function() {
        var repoRoot = path.join(testFixturesPath, 'tagged-commit-unpacked');
        var result = repoInfo(path.join(repoRoot, gitDir));

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
          root: repoRoot
        };

        assert.deepEqual(result, expected);
      });
    }

    it('returns an object with repo info, including the tag (unpacked tags) when a tag object does not exist', function() {
      var repoRoot = path.join(testFixturesPath, 'tagged-commit-unpacked-no-object');
      var result = repoInfo(path.join(repoRoot, gitDir));

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
        root: repoRoot
      };

      assert.deepEqual(result, expected);
    });

    if (zlib.inflateSync) {
      it('returns an object with repo info, including the tag (annotated tags)', function() {
        var repoRoot = path.join(testFixturesPath, 'tagged-annotated');
        var result = repoInfo(path.join(repoRoot, gitDir));

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
          root: repoRoot
        };

        assert.deepEqual(result, expected);
      });
    }

    it('returns an object with repo info, including the full branch name, if the branch name includes any slashes', function() {
      var repoRoot = path.join(testFixturesPath, 'branch-with-slashes');
      var result = repoInfo(path.join(repoRoot, gitDir));

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
        root: repoRoot
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object with repo info for linked worktrees', function() {
      process.chdir(path.join(testFixturesPath, 'linked-worktree', 'linked'));
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
        root: path.join(testFixturesPath, 'linked-worktree')
      };

      assert.deepEqual(result, expected);
    });

    it('returns an object for repo info for submodules', function() {
      process.chdir(path.join(testFixturesPath, 'submodule', 'my-submodule'));
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
        // This is a pretty meaningless "root" path.  The other information is
        // correct, but we do not have full support for submodules at the
        // moment.
        root: path.join(testFixturesPath, 'submodule', 'dot-git', 'modules')
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
