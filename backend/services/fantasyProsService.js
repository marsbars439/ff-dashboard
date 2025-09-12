const { execFile } = require('child_process');
const path = require('path');

const PYTHON = process.env.PYTHON || 'python3';

async function scrapeRosRankings() {
  const script = path.join(__dirname, '..', 'scripts', 'fp_ros_scraper.py');
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [script, '--json'], { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('ROS scraper failed:', stderr.toString());
        reject(err);
        return;
      }
      try {
        const data = JSON.parse(stdout.toString());
        resolve(data);
      } catch (parseErr) {
        console.error('Failed to parse ROS scraper output:', parseErr);
        reject(parseErr);
      }
    });
  });
}

module.exports = { scrapeRosRankings };
