# Domotz custom driver emulator
Write custom driver code and run it in your local machine
# Setup
```bash
$ npm install
```
# Use
Create the custom driver under src folder and execute it using
```bash
$ npm start --source=driver1.js
```
This previous call will execute `get_status` function in the driver source code
To execute `validate` function
```bash
$ npm start --source=driver1.js --action=validate
```
# How it works
To create a new custom driver source file under src folder
```bash
$ npm run generate --source=driver1.js
```


