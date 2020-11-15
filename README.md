# create-xxx-app

Create Node.js project with template. 

create-xxx-app(CXA) doesn't force you use specific framework.
It's for any Node.js projects.

## Usage

Basic Usage:

```
npx create-xxx-app projectname --template react
```

With addons:

```
npx create-xxx-app projectname --template react --addon eslint,prettier
```

`--template templateName` means copy template from `cxa-template-templateName` package.
In this case, `--template react` is based on [cxa-template-react](https://github.com/kotofurumiya/cxa-template-react).

## File URL

You can also use `file://` URL.

```
npx create-xxx-app projectname --template file:///path/to/your/template
```

## Create Template

See [cxa-template-react](https://github.com/kotofurumiya/cxa-template-react) as a sample.

You need to publish your template as a package to npm if it's public template.
When you use local or private template, please use `file://` URL.

## License

See [LICENSE](./LICENSE) file.