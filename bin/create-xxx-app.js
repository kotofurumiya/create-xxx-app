#!/usr/bin/env node
const { argv } = require('yargs')
const { init } = require('../lib/cxa');

init(argv._[0], { templateName: argv.template });