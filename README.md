## git-repo-info

Retrieves repo information without relying on the `git` command.

### Usage

```javascript
var getRepoInfo = require('git-repo-info');

var info = getRepoInfo();

info.branch         //=> will be the current branch
info.sha            //=> will be the current sha
info.abbreviatedSha //=> will be the first 10 chars of the current sha
```

When called without any arguments, `git-repo-info` will automatically lookup upwards
into parent directories to find the first match with a `.git` folder.

If passed an argument, it will be assumed to be the path to the repo's `.git` folder
to inspect.
