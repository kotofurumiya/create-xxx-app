const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const cp = require('child_process');
const tar = require('tar');

const downloadPackage = async (packageName, directory) => {
  const filename = cp.spawnSync('npm', ['pack', packageName], { cwd: directory }).stdout.toString().trim();
  const extractDir = path.join(directory, packageName);
  fs.ensureDirSync(extractDir);
  await tar.extract({ file: path.join(directory, filename), cwd: extractDir });
  return path.join(extractDir, 'package');
};

const init = async (projectName, options = {}) => {
  const { templateName } = options;
  const command = 'npm';

  if(!templateName) { throw new Error('--template option is missing.'); }

  // dir paths
  const cwd = process.cwd();
  const tmpDir = os.tmpdir();
  const projectDir = path.join(cwd, projectName);

  // check if project dir exists
  const existsDir = fs.existsSync(projectName);
  if(existsDir) { throw new Error(`"${projectName}" directory already exists.`); }

  // download template
  const templateDir = await downloadPackage(`cxa-template-${templateName}`, tmpDir);
  const existsTemplate = fs.existsSync(templateDir);
  if(!existsTemplate) { throw new Error(`Template "${templateName}" not found.`); }

  const templateJson = require(path.join(templateDir, 'template.json'));

  // init dir
  fs.mkdirSync(projectDir);
  cp.spawnSync(command, ['init', '-y'], { cwd: projectDir });

  // copy files and run `npm install`
  fs.copySync(path.join(templateDir, 'files'), projectDir);
  cp.spawnSync(command, ['install'], { cwd: projectDir, stdio: 'inherit' });

  // merge package.json
  const packageJson = require(path.join(projectDir, 'package.json'));
  packageJson.scripts = {...packageJson.scripts, ...templateJson.package.scripts};
  fs.writeJSONSync(path.join(projectDir, 'package.json'), packageJson);

  // install dependencies
  const dependencies = (templateJson.package.dependencies || []).map(({name}) => name);
  const devDependencies = (templateJson.package.devDependencies || []).map(({name}) => name);

  cp.spawnSync(command, ['install', '--save', ...dependencies], { cwd: projectDir, stdio: 'inherit' });
  cp.spawnSync(command, ['install', '--save-dev', ...devDependencies], { cwd: projectDir, stdio: 'inherit' });
};

module.exports = {
  init
};