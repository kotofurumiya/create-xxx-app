const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const url = require('url');
const cp = require('child_process');
const tar = require('tar');

const fetchNpmPackage = async (packageName, directory) => {
  const filename = cp.spawnSync('npm', ['pack', packageName], { cwd: directory }).stdout.toString().trim();
  const extractDir = path.join(directory, packageName);
  fs.ensureDirSync(extractDir);
  await tar.extract({ file: path.join(directory, filename), cwd: extractDir });
  return path.join(extractDir, 'package');
};

const fetchPackage = async (templateNameOrUrl) => {
  const tmpDir = os.tmpdir();

  // file scheme
  if (templateNameOrUrl.startsWith('file://')) {
    const templatePath = url.fileURLToPath(templateNameOrUrl);
    const parsedPath = path.parse(templatePath);
    const name = parsedPath.name;
    const extractDir = path.join(tmpDir, name);
    fs.ensureDirSync(extractDir);
    fs.copySync(templatePath, extractDir);
    return extractDir;
  }

  // npm
  const packageName = `cxa-template-${templateNameOrUrl}`;
  return fetchNpmPackage(packageName, tmpDir);
};

const init = async (projectName, options = {}) => {
  const { useYarn, template, addon } = options;
  const command = useYarn ? 'yarn' : 'npm';
  const installDepsSubcommands = useYarn ? ['add'] : ['install'];
  const installDevDepsSubcommands = useYarn ? ['add', '-D'] : ['install', '-D'];
  const addonNames = Array.isArray(addon) ? addon : addon?.split(',').map((a) => a.trim()) || [];

  if (!template) {
    throw new Error('--template option is missing.');
  }

  // dir paths
  const cwd = process.cwd();
  const projectDir = path.join(cwd, projectName);

  // check if project dir exists
  const existsDir = fs.existsSync(projectName);
  if (existsDir) {
    throw new Error(`"${projectName}" directory already exists.`);
  }

  // download template
  const templateDir = await fetchPackage(template);
  const existsTemplate = fs.existsSync(templateDir);
  if (!existsTemplate) {
    throw new Error(`Template "${template}" not found.`);
  }

  const templateJson = require(path.join(templateDir, 'template.json'));

  // addons conjunction
  const addonTemplateJson = addonNames
    .map((addonName) => {
      try {
        const json = require(path.join(templateDir, 'addons', addonName, 'template.json'));
        return json;
      } catch (e) {
        console.error(`Addon "${addonName}" not found.`);
        process.exit(1);
      }
    })
    .reduce((prev, current) => ({
      package: {
        scripts: { ...(prev.package?.scripts || {}), ...(current.package?.scripts || {}) },
        dependencies: [...(prev.package?.dependencies || []), ...(current.package?.dependencies || [])],
        devDependencies: [...(prev.package?.devDependencies || []), ...(current.package?.devDependencies || [])]
      }
    }), {});

  // init dir
  fs.mkdirSync(projectDir);
  cp.spawnSync(command, ['init', '-y'], { cwd: projectDir });

  // copy files
  fs.copySync(path.join(templateDir, 'files'), projectDir);

  for(const a of addonNames) {
    fs.copySync(path.join(templateDir, 'addons', a, 'files'), projectDir);
  }

  // rename `gitignore` to `.gitignore`.
  // we cannot upload `.gitignore` in npm package, because npm omit `.gitignore` file.
  const gitignorePath = path.join(projectDir, 'gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      fs.renameSync(gitignorePath, path.join(projectDir, '.gitignore'));
    } catch (e) {
      console.warn('Failed to rename gitignore.');
    }
  }

  // run `npm install`
  cp.spawnSync(command, ['install'], { cwd: projectDir, stdio: 'inherit' });

  // merge package.json
  const packageJson = require(path.join(projectDir, 'package.json'));

  packageJson.scripts = {
    ...(packageJson.scripts || {}),
    ...(templateJson.package?.scripts || {}),
    ...(addonTemplateJson.package?.scripts || {})
  };
  fs.writeJSONSync(path.join(projectDir, 'package.json'), packageJson);

  // install dependencies
  const templateDeps = templateJson.package?.dependencies || [];
  const templateDevDeps = templateJson.package?.devDependencies || [];
  const addonDeps = addonTemplateJson.package?.dependencies || [];
  const adddonDevDeps = addonTemplateJson.package?.devDependencies || [];

  const combinedDependencies = [...templateDeps, ...addonDeps];
  const combinedDevDependencies = [...templateDevDeps, ...adddonDevDeps];

  const dependencies = combinedDependencies.map(({ name }) => name);
  const devDependencies = combinedDevDependencies.map(({ name }) => name);

  cp.spawnSync(command, [...installDepsSubcommands, ...dependencies], {
    cwd: projectDir,
    stdio: 'inherit'
  });
  cp.spawnSync(command, [...installDevDepsSubcommands, ...devDependencies], {
    cwd: projectDir,
    stdio: 'inherit'
  });
};

module.exports = {
  init
};
