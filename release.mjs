// script.mjs
import fs from 'fs';
import prompts from 'prompts';
import simpleGit from 'simple-git';

const git = simpleGit();

function incrementVersion(version) {
    const versions = version.split('.').map(Number);
    versions[2] += 1; // Increment PATCH version
    return versions.join('.');
}


(async function() {
    const currentVersion = JSON.parse(fs.readFileSync('./package.json')).version;
    const incrementedVersion = incrementVersion(currentVersion);

    const response = await prompts({
        type: 'text',
        name: 'version',
        message: 'Enter the version to publish',
        initial: incrementedVersion
    });

    const version = response.version;

    const packageJson = JSON.parse(fs.readFileSync('package.json'));
    packageJson.version = version;
    fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));

    const tagVersion = `v${version}`;

    await git.add('./*');
    console.log('Files staged.');

    await git.commit(`Release ${tagVersion}`);
    console.log('Files committed.');

    try {
        await git.addTag(tagVersion);
        console.log('Tag version added.');
    } catch (err) {
        console.log('No previous tags found. New tag created.');
    }

    await git.push('origin', 'HEAD'); // Pushes changes to the repository
    console.log('Repository changes pushed.');

    await git.push('origin', tagVersion); // Pushes the new tag
    console.log('Tag version pushed.');

    console.log('Push complete.');
})();
