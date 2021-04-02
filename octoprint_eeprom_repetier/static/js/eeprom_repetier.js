/**
 * Created by Salandora on 27.07.2015.
 */
$(function() {
    function EepromRepetierViewModel(parameters) {
        var self = this;

        self.control = parameters[0];
        self.connection = parameters[1];

        self.firmwareRegEx = /FIRMWARE_NAME:([^\s]+)/i;
        self.repetierRegEx = /Repetier_([^\s]*)/i;
        self.firmwareVersion = "Unknown";

        self.eepromDataRegEx = / EPR:(\d) (\d+) ([^\s]+) (.+)/;

        self.pluginUrl = "plugin/eeprom_repetier/";

        self.isRepetierFirmware = ko.observable(false);

        self.isConnected = ko.computed(function() {
            return self.connection.isOperational() || self.connection.isPrinting() ||
                   self.connection.isReady() || self.connection.isPaused();
        });

        self.showUnsavedValues = ko.observable(false);

        self.isModified = ko.computed(function() {
            var result = false;
            if (self.showUnsavedValues()) {
                _.each(self.eepromData(), function(data) {
                    data.modified(data.value != data.origValue);
                    if (data.modified()) result = true;
                });
            }
            return result;
        });

        self.eepromData = ko.observableArray([]);

        self.backupFiles = ko.observableArray([]);

        self.onStartup = function() {
            $('#settings_plugin_eeprom_repetier_link a').on('show', function(e) {
                if (self.isConnected() && !self.isRepetierFirmware())
                    self._requestFirmwareInfo();
            });
        }

        self.fromHistoryData = function(data) {
            _.each(data.logs, function(line) {
                self.checkRepetierFirmware(line);
            });
        };

        self.fromCurrentData = function(data) {
            if (!self.isRepetierFirmware()) {
                _.each(data.logs, function (line) {
                    self.checkRepetierFirmware(line);
                });
            }
            else
            {
                _.each(data.logs, function (line) {
                    var match = self.eepromDataRegEx.exec(line);
                    if (match) {
                        self.eepromData.push({
                            dataType: match[1],
                            position: match[2],
                            origValue: match[3],
                            value: match[3],
                            description: match[4],
                            modified: ko.observable(false)
                        });
                    }
		            else if (line.includes("Info:Configuration stored to EEPROM")) {
			            self.showPopup("success", "Configuration stored to EEPROM.", "");
		            }
		            else if (line.includes("Info:Configuration reset to defaults")) {
			            self.showPopup("success", "Configuration reset to defaults.", "");
                    }
                });
            }
        };

        self.checkRepetierFirmware = function(line) {
            var firmware = "";
            var match = self.firmwareRegEx.exec(line);
            if (match) {
                firmware = self.repetierRegEx.exec(match[0]);
                if (firmware) {
                    self.firmwareVersion = firmware[0];
                    self.isRepetierFirmware(true);
                }
            }
        };

        self.onEventConnected = function() {
            self._requestFirmwareInfo();
        };

        self.onEventDisconnected = function() {
            self.isRepetierFirmware(false);
        };

        self.loadEeprom = function() {
            self.eepromData.removeAll();
            self.showUnsavedValues(false);
            if (self.isConnected()) {
                self._requestEepromData();
            }
        };

        self.saveEeprom = function()  {
            var eepromData = self.eepromData();
            var changed = false;
            _.each(eepromData, function(data) {
                if (data.origValue != data.value) {
                    self._requestSaveDataToEeprom(data.dataType, data.position, data.value);
                    data.origValue = data.value;
		            changed = true;
                }
            });
            if (changed) {
                self.showPopup("success", "All changed values stored to EEPROM.", "");
            }
        };

        self.resetEeprom = function () {
            showConfirmationDialog({
                message: "Are you sure? Also remember to reset printer to take effect.",
                onproceed: function() {
                    self.control.sendCustomCommand({ command: "M502"});
                    self.control.sendCustomCommand({ command: "M500"});
                },
            });
        };

        self._requestFirmwareInfo = function() {
            self.control.sendCustomCommand({ command: "M115" });
        };

        self._requestEepromData = function() {
            if (self.isRepetierFirmware()) {
                self.control.sendCustomCommand({ command: "M205" });
            }
        };

        self._requestSaveDataToEeprom = function(data_type, position, value) {
            var cmd = "M206 T" + data_type + " P" + position;
            if (data_type == 3) {
                cmd += " X" + value;
            }
            else {
                cmd += " S" + value;
            }
            self.control.sendCustomCommand({ command: cmd });
        };

        self.showPopup = function(message_type, title, text) {
            if (self.popup !== undefined) {
                self.closePopup();
            }
            self.popup = new PNotify({
                title: gettext(title),
                text: text,
                type: message_type,
                hide: false
            });
        };

        self.closePopup = function() {
            if (self.popup !== undefined) {
                self.popup.remove();
            }
        };

        // ======= Backup feature ========
        self.listBackups = function () {

            OctoPrint.get(self.pluginUrl+"list")
            .done(function(response) {
               self.backupFiles.removeAll();
               response.files.sort().reverse();
               _.each(response.files, function(f) {
                   self.backupFiles.push({name: f.filename, url: f.url});
               });
            });
            return true;
        };

        self.backupCurrent = function () {
            
            if (self.eepromData().length > 0) {
                // Only include specific Eeprom data fields
                var eepromData = self.eepromData();
                var backupData = [];
                _.each(eepromData, function(data) {
                    backupData.push({
                        position: data.position, 
                        dataType: data.dataType, 
                        value: data.value,
                        description: data.description
                    });
                });
                OctoPrint.postJson(
                    self.pluginUrl+"backup",
                    { backup_description:"Firmware version: "+self.firmwareVersion, backup_data: backupData }
                )
                .done(function(response) {
                    self.showPopup("success", "Backup Complete.", "Current data backed up to " + response.name);
                    self.listBackups();
                });
            }
        };

        self.restoreBackup = function(filename) {
            if (self.eepromData().length < 1) {
                self.loadEeprom();
            }

            showConfirmationDialog({
                message: "Replace the current display values with this backup data.",
                onproceed: function() {
                    OctoPrint.get(self.pluginUrl+"backup"+"/"+filename)
                    .done(function(response) {
                        var backupData = JSON.parse(response.data).backup_data;

                        // Loop through backupData and replace the value of any matching elements in the current data set
                        var eepromData = self.eepromData.removeAll();
                        _.each(eepromData, function(e) {
                            _.each(backupData, function(b) {
                                if (b.position == e.position && b.dataType == e.dataType) {
                                    e.value = b.value;
                                }
                            });
                            self.eepromData.push(e);
                        });

                        self.showPopup("success", "Backup retrieved to current display values.", "Review the current values and load them to EEPROM if required.");
                        self.listBackups();
                    });
                },
            });
        };

        self.removeBackup = function(filename) {
            showConfirmationDialog({
                message: `Delete backup file ${filename}.`,
                onproceed: function() {
                    OctoPrint.delete(self.pluginUrl+"backup"+"/"+filename)
                    .done(function(response) {
                        self.showPopup("success", `Backup ${filename} deleted.`, "");
                    });
                    self.listBackups();
                },
            });
        };

    }

    OCTOPRINT_VIEWMODELS.push({
        construct: EepromRepetierViewModel,
        additionalNames: [],
        dependencies: ["controlViewModel", "connectionViewModel"],
        optional: [],
        elements: ["#settings_plugin_eeprom_repetier"]
    });
});
