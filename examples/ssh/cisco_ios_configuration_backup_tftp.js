const TFTP_SERVER_IP = '192.168.1.10';  // Update this to your server's reachable IP
const TFTP_FILENAME = 'the_backup.cfg';
const SSH_TIMEOUT = 10000;  // SSH timeout in milliseconds
const TFTP_TIMEOUT = 20000; // TFTP server timeout in milliseconds

const sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    prompt: '#',
    inter_command_timeout_ms: '5000',
    timeout: SSH_TIMEOUT,
    commands: []
};

function handleSshError(error) {
    console.error("SSH error:", error ? error.message : 'Unknown error');
    if (error && error.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (error && (error.code === 255 || error.code === 1)) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function getPrompt(output) {
    if (!output || !output[0]) {
        console.error('No SSH output received to extract prompt.');
        D.failure(D.errorType.GENERIC_ERROR);
    }
    const lines = output[0].split('\r\n');
    return lines.length >= 3 ? lines[2] : sshOptions.prompt;
}

function sendTftpCommandCallback(output, error) {
    console.info("tftp callback")
    console.info("sendTftpCommandCallback output:", output);
    console.error("sendTftpCommandCallback error:", error);
    if (error) {
        handleSshError(error);
        return;
    }

    console.info("TFTP command output:", output);

    const confirmation = output.join('\n');
    if (confirmation.includes('bytes copied')) {
        console.info("TFTP backup command completed successfully, upload confirmed.");
    } else {
        console.error("TFTP backup may have failed, no confirmation of bytes copied.");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function sendTftpCopyCommand() {
    
    const tftpCommands = [
        'copy running-config tftp:\r' + TFTP_SERVER_IP + '\r' + TFTP_FILENAME,
    ]
    sshOptions.commands = tftpCommands;
    console.info("Sending command to copy running config to TFTP server:", 'copy running-config tftp' + TFTP_SERVER_IP + TFTP_FILENAME);
    D.device.sendSSHCommands(sshOptions, sendTftpCommandCallback);
}

function startTftpServerAndSync() {
    const serverOptions = {
        port: 69,
        filePath: TFTP_FILENAME,
        timeout: TFTP_TIMEOUT,
    };

    function onReady(error, host, port) {
        if (error) {
            console.error("TFTP server not ready: %o", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        console.info('TFTP server ready on %s:%s', host, port);
        sendTftpCopyCommand();
    }

    function onUpload(error, content) {
        if (error) {
            console.error("File transfer error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }

        console.info('Received file upload, length of content: %d bytes', content.length);
        const snippet = content.substring(0, 100);
        console.info('Snippet of uploaded file:', snippet);
        var backup = D.createBackup({
            label: "Running Config Backup", 
            running: content
        });
        D.success(backup);

        console.info("File transfer complete.");
    }

    D.tftpServer.accept(serverOptions, onReady, onUpload);
}

function validate() {
    D.device.sendSSHCommands(sshOptions, function(output, error) {
        if (error) {
            handleSshError(error);
        } else {
            console.info("Validation successful.");
            D.success();
        }
    });
}

function startBackup() {
    console.info("Starting the TFTP server and SSH copy process...");
    startTftpServerAndSync();
}


function backup() {
    startBackup();
}