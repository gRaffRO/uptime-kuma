const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const ffmpegStatic = require('ffmpeg-static');
const { spawn } = require('child_process');

class RtmpbMonitorType extends MonitorType {
    name = "RTMP";

    async check(monitor, heartbeat) {
        const rtmpUrl = monitor.url;

        console.log(`Checking RTMP server with URL: ${rtmpUrl}`);

        const ffmpegCmd = [
            '-re',
            '-f', 'lavfi',
            '-i', 'color=c=black:s=1280x720:r=30',
            '-f', 'lavfi',
            '-i', 'anullsrc',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-c:a', 'aac',
            '-ar', '44100',
            '-b:v', '1500k',
            '-maxrate', '1500k',
            '-bufsize', '750k',
            '-g', '60',
            '-f', 'flv',
            `${rtmpUrl}`
        ];

        const ffmpegProcess = spawn(ffmpegStatic, ffmpegCmd, { stdio: ['pipe', 'pipe', 'pipe'] });

        let streamSuccess = false;

        ffmpegProcess.stderr.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Stream mapping:') || output.includes('Output #0')) {
                console.log('RTMP server is working and accepting the stream.');
                streamSuccess = true;
                ffmpegProcess.kill('SIGINT');
            } else if (output.includes('Error')) {
                console.log('RTMP server is not working and not accepting the stream.');
                streamSuccess = false;
            }
        });

        return await (new Promise((resolve, reject) => {
            ffmpegProcess.on('exit', (code) => {
                if (streamSuccess) {
                    console.log('RTMP server check successful.');
                    heartbeat.status = UP;
                    heartbeat.msg = "RTMP server is working and accepting the stream.";
                    resolve();
                } else {
                    console.log('RTMP server check failed.');
                    heartbeat.status = DOWN;
                    heartbeat.msg = "RTMP server is not working and not accepting the stream.";
                    reject(new Error("RTMP server is not working and not accepting the stream."));
                }
            });

            ffmpegProcess.on('error', (error) => {
                console.log('Failed to execute FFmpeg process.');
                heartbeat.status = DOWN;
                heartbeat.msg = "Failed to execute FFmpeg process.";
                reject(new Error("Failed to execute FFmpeg process."));
            });
        }));
    }
}

module.exports = {
    RtmpbMonitorType,
};
