'use strict';

var async = require('async');
var packageList = require('./package_list.json');
var githubUrl = /^https?:\/\/github\.com\/([^\/\.\s]+)\/([^\/\.\s]+)/;
var GitHub = require('github-api');

var remotePackages = ['xfiveco', 'composer-repository', 'repository', 'packages.json'];
var commitMessage = 'Bot updates packages';

if(!process.env.GITHUB_AUTH) {
  console.log('GitHub auth is missing');
  process.exit(1);
}

var auth = process.env.GITHUB_AUTH.split(':')

var gh = new GitHub({
  username: auth[0],
  password: auth[1]
});

function findCommitIdForRepository(repository, id, cb) {
  var parsedRepository = githubUrl.exec(repository);
  if(!parsedRepository) {
    cb('Failed when parsing repository');
  }
  gh.getRepo(parsedRepository[1], parsedRepository[2])
      .getSingleCommit('master', (err, res) => cb(err, res.sha));
}

function generatePackages(packageList, commits, cb) {
  var packages = {};
  Object.keys(packageList).forEach((key) => {
    packages[key] = {
      "dev-master": {
        "name": key,
        "version": "dev-master",
        "type": "wordpress-plugin",
        "source": {
          "url": packageList[key],
          "type": "git",
          "reference": commits[key]
        }
      }
    }
  });
  packages = {packages: packages};
  var str = JSON.stringify(packages, null, 2);
  cb(null, str);
}

function readRemotePackeges(path, newPackages, cb) {
  gh.getRepo(path[0], path[1]).getContents(path[2], path[3], false,
    (err, res) => cb(err, new Buffer(res.content, 'base64').toString('utf8'), newPackages));
}

function writeNewPackagesIfNecessary(path, oldPackages, newPackages, cb) {
  if(oldPackages === newPackages) {
    console.log('No changes detected');
    process.exit(0);
  }
  gh.getRepo(path[0], path[1]).writeFile(path[2], path[3], newPackages,
    commitMessage, cb);
}

async.waterfall([
  (cb) => async.mapValuesLimit(packageList, 5, findCommitIdForRepository, cb),
  (packageCommits, cb) => generatePackages(packageList, packageCommits, cb),
  (newPackages, cb) => readRemotePackeges(remotePackages, newPackages, cb),
  (oldPackages, newPackages, cb) =>
    writeNewPackagesIfNecessary(remotePackages, oldPackages, newPackages, cb)
], (err) => {
  if(err) {
    console.log('Error: '+err.toString());
    process.exit(1);
  }
  console.log('Everything went well :)');
})
