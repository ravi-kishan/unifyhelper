#!/usr/bin/env node

var glob = require("glob")
const semver = require("semver")
const boxen = require("boxen");
const chalk  = require('chalk');
var exec = require('child_process').exec;
const fs = require("fs");
path = require('path');
var myArgs = process.argv.slice(2);

var testFiles = [];

const getAllFiles = function(dirPath) {
    files = fs.readdirSync(dirPath)
  
    files.forEach(function(file) {
        if( file != ".bin") {
        
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
          getAllFiles(dirPath + "/" + file)
        } else {
          if(file.substr(-8) === '.test.js')
          testFiles.push(path.join(dirPath, "/", file));
        }
      }
    })

  }

myArgs.forEach((value,index,array) => {
    getAllFiles("node_modules/" + value);
})

if(myArgs.length == 0) {
  getAllFiles("node_modules");
}



var overall= {};

const findVersions = function(){
    return new Promise((res, rej)=>{
      var result = [];
      var completed = 0;
      myArgs.forEach((value,index,array) => {
        glob("node_modules/" + value +"/**/package.json",  function (er, files) {
          if(er) rej(er);
          result = result.concat(files);
          completed++;
          if(completed == myArgs.length) {
            res(result);
          }
      });
    })

      if(myArgs.length == 0) {
         glob("node_modules/**/package.json",  function (er, files) {
          if(er) rej(er);
          result = result.concat(files);
            res(result);
          
      });
      }

    })
}
const removingDuplicates = function(){
    return new Promise((res, rej)=>{

exec("npm dedupe", function(err, stdout, stderr) {
    if(err)rej(err);
    res(stdout);
  });
})
}


const runTests = function(){
  return new Promise((res, rej)=>{
testFiles.forEach((value,index,array) => {
  exec("_mocha "+ value + " --require esm --colors", function(err, stdout, stderr) {
    if(err)rej(err);
    console.log(stdout);
   });

})

})
}




console.log(chalk.blue("Finding Version Conflicts ..."));

findVersions()
.then((files)=>{
    files.forEach((value,index,array) => {
    
        var currentPackage = require(path.resolve(__dirname, '..','..',value));
        if(currentPackage.dependencies != undefined) {
        Object.keys(currentPackage.dependencies).forEach((valueDep,indexDep,arrayDep) =>{
            if(overall[valueDep] == undefined)
            {
                overall[valueDep] = new Set();
            }
            overall[valueDep].add(currentPackage.dependencies[valueDep]);
       
        });
    }
        
      });
      var conflictFound = false;
      Object.keys(overall).forEach((value,index,array) => {
        if(overall[value].size > 1)
        {
            var resolves = false;
            overall[value].forEach((choosenValue) => {
                var choosen = true;
                overall[value].forEach((otherValue) => {
                  if(choosenValue[0] == '^' || choosenValue[0] == '~')choosenValue = choosenValue.slice(1);

                    if(!semver.satisfies(choosenValue,otherValue)){
                        choosen = false;
                    }
                });
                if(choosen)resolves = true;
            });

            if(!resolves){
                console.log(boxen(chalk.yellow(value + " has a version conflict"), {padding: 1}));
                conflictFound = true;
            }
           
        }
      });
      if(conflictFound == false)
      {
        console.log(boxen(chalk.green("No version conflicts found"),{padding: 1}));
      }
      console.log(chalk.blue("Removing compatible duplicates ..."));
      removingDuplicates()
      .then((stdout) => {
        console.log(boxen(chalk.green("Removed Compatible Duplicates"),{padding: 1}));

        console.log(chalk.blue("Running Tests ..."));
         
        runTests()
        .then((stdout) =>  {
          console.log(stdout);
        })

      });


});





