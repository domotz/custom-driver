// Simulated IBM i (AS/400) V6R1M1 telnet 5250 session, Italian locale. The driver logs in ("user\tpass" are the fake
// device credentials), runs WRKPRB and counts the problems by the status text "READY" on the "Gestione problemi" list
// (validate only needs that screen). The text of the screen is inferred from the driver (no public capture).
const reply = require("../../replies");

const LOGIN = "user\tpass\r\n\r\nWRKPRB\r\n";

const LIST = [
    "                              Gestione problemi",
    "                                                              Sistema: AS400PROD",
    " Opzioni: 5=Visualizza dettagli  8=Gestione problema",
    "",
    " Opz  ID problema  Stato     Descrizione",
    "      9190541234   READY     Errore dispositivo di memorizzazione",
    "      9190541300   READY     Errore di comunicazione",
    "                                                                    Fine",
    " Utente . . . . . .",
    ""
].join("\r\n");

// get_status counts the READY problems on the list, then sends "5" (display details) and Down for each one; every
// details screen shows the problem id, the reference code (SRC...) and the date.
const DETAILS_COMMAND = LOGIN + "5\r\n\r\n\x1B[B".repeat(2);

const detail = (id, src, date) => [
    "                        Visualizzazione dettagli problema",
    " ID problema . . . . . . . . . . . . . :   " + id,
    " Codice di riferimento sistema . . . . :   " + src,
    " Data e ora rilevazione  . . . . . . . :   " + date,
    ""
].join("\r\n");

const DETAILS = LIST + detail("9190541234", "SRCB6005104", "10/26/26  22:14:05") + detail("9190541300", "SRCB2003110", "10/27/26  07:41:30");

module.exports = {
    cases: [{
        name: "two ready problems",
        entryPoints: {
            validate: { calls: [{ kind: "telnet", method: "sendTelnetCommand", target: LOGIN, reply: reply.telnet(LIST) }] },
            get_status: {
                calls: [
                    { kind: "telnet", method: "sendTelnetCommand", target: LOGIN, reply: reply.telnet(LIST) },
                    { kind: "telnet", method: "sendTelnetCommand", target: DETAILS_COMMAND, reply: reply.telnet(DETAILS) }
                ]
            }
        }
    }]
};
