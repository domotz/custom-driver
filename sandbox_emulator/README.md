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
The previous call will execute `get_status` function in the driver source code.\
To execute `validate` function:
```bash
$ npm start --source=driver1.js --action=validate
```
# How it works
To create a new custom driver source file under src folder
```bash
$ npm run generate --source=driver1.js
```
To configure the device ip, username and password create .env file or define thoses variables under your environment variable
```bash
DEVICE_IP: the target device ip address or domain name
DEVICE_USERNAME: the target device username
DEVICE_PASSWORD: the target device password
DEVICE_SNMP_COMMUNITY_STRING: community string used for snmp protocol
```


