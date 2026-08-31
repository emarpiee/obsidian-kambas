import { execSync } from 'child_process';
import fs from 'fs';

try {
	let latestTag = '';
	let previousTag = '';

	try {
		const tags = execSync('git tag --sort=-v:refname', { encoding: 'utf8' })
			.trim()
			.split('\n')
			.filter(Boolean);

		if (tags.length > 0) {
			latestTag = tags[0];
		}
		if (tags.length > 1) {
			previousTag = tags[1];
		}
	} catch (e) {
		console.log(
			'⚠️ Git command failed or not a git repository. Proceeding with caution...'
		);
	}

	const formatStr = '--pretty=format:"* %s (%h)"';
	let commits = '';
	let titleHeader = 'Changelog';

	if (latestTag) {
		commits = execSync(`git log ${latestTag}..HEAD ${formatStr}`, {
			encoding: 'utf8',
		}).trim();

		if (!commits) {
			if (previousTag) {
				console.log(
					`📍 HEAD is at ${latestTag}. Fetching changes since previous tag (${previousTag})...`
				);
				commits = execSync(
					`git log ${previousTag}..${latestTag} ${formatStr}`,
					{ encoding: 'utf8' }
				).trim();
			} else {
				console.log(
					`📍 HEAD is at ${latestTag} (First Tag). Fetching recent history...`
				);
				commits = execSync(`git log ${latestTag} -n 500 ${formatStr}`, {
					encoding: 'utf8',
				}).trim();
			}
			titleHeader = `Changelog for ${latestTag}`;
		} else {
			console.log(
				`🚀 Found new commits since ${latestTag}. Generating upcoming changelog...`
			);
			titleHeader = `Changelog (Upcoming Release since ${latestTag})`;
		}
	} else {
		console.log('No git tags found. Fetching recent commit history instead.');
		commits = execSync(`git log -n 20 ${formatStr}`, {
			encoding: 'utf8',
		}).trim();
		titleHeader = 'Changelog (Recent History)';
	}

	if (!commits) {
		console.log('❌ No commit history found.');
		process.exit(0);
	}

	const changelogContent = `## ${titleHeader} (${new Date().toLocaleDateString()})\n\n${commits}\n`;
	fs.writeFileSync('CHANGELOG.md', changelogContent, 'utf8');
	console.log('✅ CHANGELOG.md has been generated successfully!');
} catch (error) {
	console.error('❌ Error generating changelog:', error.message);
	process.exit(1);
}
