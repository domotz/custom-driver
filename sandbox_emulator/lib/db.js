const sqlite3 = require('sqlite3')
const { Database, open } = require("sqlite")
var { valueTypes } = require("./constants")

class DatabaseManager {
    async init() {
        this.driverName = process.argv[2]
        this.db = await open({
            filename: "data.db",
            driver: sqlite3.Database
        })

        if (!await this.checkTable("variables")) {
            console.log("table variables not found, creating table")
            await this.db.exec(`create table variables 
                (
                    host text, 
                    driver text,
                    row_id text,
                    uid text, 
                    label text, 
                    value text, 
                    unit text, 
                    type text,
                    date integer, 
                    last boolean)`
            )
        }

        return this.db;
    }
    /**
     * 
     * @param {string} tableName 
     * @returns if table exists
     */
    async checkTable(tableName) {
        return this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", tableName)
    }
    /**
    * 
    * @param {{host: string, uid: string, row_id: string, label: string, value: string, unit: string, valueType: string}} data 
    */
    async addVar(data) {
        var result = data.value;
        var now = new Date().getTime()
        if ([valueTypes.RATE, valueTypes.MONOTONE_RATE].includes(data.valueType)) {
            var last = await this.getLastValue(data.host, data.uid)
            if (last)
                result = (data.value - last.value) / ((now - last.date) / 1000)
            else result = null
        }
        if(data.valueType === valueTypes.MONOTONE_RATE && result < 0) return null;
        var valueToSave = (data.value && data.valueType === valueTypes.DATETIME && data.value instanceof Date) ? data.value.getTime() : data.value
        
        await this.db.run("update variables set last=0 where host=? and driver=? and uid=? "+(data.row_id ? 'and row_id=?':''), data.host, this.driverName, data.uid, data.row_id)
        await this.db.run("insert into variables values(?,?,?,?,?,?,?,?,?,?)",
            data.host,
            this.driverName,
            data.row_id,
            data.uid,
            data.label,
            valueToSave,
            data.unit,
            data.valueType,
            now,
            true
        )
        return result;
    }
    convert(input, type) {
        switch (type) {
            case valueTypes.DATETIME: {
                if (input instanceof Date) return input
                if (!isNaN(input)) return new Date(parseInt(input))
            }
            case valueTypes.NUMBER, valueTypes.RATE, valueTypes.MONOTONE_RATE: {
                if (!isNaN(input)) return parseFloat(input)
                else return null
            }
            default: return input && input.toString();
        }
    }
    getLastValue(host, uid, row_id) {
        return this.db.get("select * from variables where last=true and host=? and driver=? and uid=? " + (row_id? 'and row_id=?' : ''), host, this.driverName, uid, row_id)
                    .then(res => {
                        if(res)
                            res.value = this.convert(res.value, res.type);
                        return res;
                    })
    }
}
module.exports = new DatabaseManager()
