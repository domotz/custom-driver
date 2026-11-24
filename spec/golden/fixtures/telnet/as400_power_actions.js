// Simulated IBM i (AS/400) V6R1M1 telnet 5250 sessions, Italian locale (the driver matches "Utente" and the Italian
// menu text). Shape follows the IBM i GO POWER menu: "3. Spegnimento immediato del sistema" and "4. Spegnimento
// immediato del sistema e successiva accensione" (power off now / power off now and restart). The driver sends
// "<user>\t<password>\r\n\r\ngo power\r\n" and, for the actions, appends the menu option and F-key escape
// ("4\r\n\x1b[29~" reboot, "3\r\n\x1b[29~" shutdown). The fake device credentials are user / pass.
const reply = require("../../replies");

const LOGIN = "user\tpass\r\n\r\ngo power\r\n";

const MENU = [
    "                                    POWER",
    "                          Gestione alimentazione e riavvio",
    "                                                              Sistema: AS400PROD",
    " Selezionare una delle opzioni seguenti:",
    "",
    "      1. Visualizza stato alimentazione",
    "      2. Pianificazione accensione e spegnimento",
    "      3. Spegnimento immediato del sistema",
    "      4. Spegnimento immediato del sistema e successiva accensione",
    "",
    " Selezione o comando",
    " ===>",
    " F3=Fine   F4=Richiesta   F9=Richiama   F12=Annulla",
    ""
].join("\r\n");

const call = (command, response) => ({ kind: "telnet", method: "sendTelnetCommand", target: command, reply: reply.telnet(response) });

module.exports = {
    cases: [{
        name: "as400 v6r1m1 italian",
        entryPoints: {
            validate: { calls: [call(LOGIN, MENU)] },
            get_status: { calls: [call(LOGIN, MENU)] },
            custom_1: { calls: [call(LOGIN + "4\r\n\x1b[29~", "\r\n Conferma spegnimento e riavvio del sistema in corso\r\n")] },
            custom_2: { calls: [call(LOGIN + "3\r\n\x1b[29~", "\r\n Conferma spegnimento del sistema in corso\r\n")] }
        }
    }]
};
