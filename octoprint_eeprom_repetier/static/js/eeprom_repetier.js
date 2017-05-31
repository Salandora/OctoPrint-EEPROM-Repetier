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

        self.eepromDataRegEx = /EPR:(\d+) (\d+) ([^\s]+) (.+)/;

        self.isRepetierFirmware = ko.observable(false);

        self.isConnected = ko.computed(function() {
            return self.connection.isOperational() || self.connection.isPrinting() ||
                   self.connection.isReady() || self.connection.isPaused();
        });

        self.eepromData = ko.observableArray([]);

        self.onStartup = function() {
            $('#settings_plugin_eeprom_repetier_link a').on('show', function(e) {
                if (self.isConnected() && !self.isRepetierFirmware())
                    self._requestFirmwareInfo();
            });
        }

        self.fromHistoryData = function(data) {
            _.each(data.logs, function(line) {
                var match = self.firmwareRegEx.exec(line);
                if (match != null) {
                    if (self.repetierRegEx.exec(match[0]))
                        self.isRepetierFirmware(true);
                }
            });
        };

        self.fromCurrentData = function(data) {
            if (!self.isRepetierFirmware()) {
                _.each(data.logs, function (line) {
                    var match = self.firmwareRegEx.exec(line);
                    if (match) {
                        if (self.repetierRegEx.exec(match[0]))
                            self.isRepetierFirmware(true);
                    }
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
                            description: match[4]
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

        self.onEventConnected = function() {
            self._requestFirmwareInfo();
        }

        self.onEventDisconnected = function() {
            self.isRepetierFirmware(false);
        };

        self.loadEeprom = function() {
            self.eepromData([]);
            self._requestEepromData();
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
        }

        self._requestFirmwareInfo = function() {
            self.control.sendCustomCommand({ command: "M115" });
        };

        self._requestEepromData = function() {
            self.control.sendCustomCommand({ command: "M205" });
        }

        self._requestSaveDataToEeprom = function(data_type, position, value) {
            var cmd = "M206 T" + data_type + " P" + position;
            if (data_type == 3) {
                cmd += " X" + value;
                self.control.sendCustomCommand({ command: cmd });
            }
            else {
                cmd += " S" + value;
                self.control.sendCustomCommand({ command: cmd });
            }
        }

        self.showPopup = function(message_type, title, text){
            if (self.popup !== undefined){
                    self.closePopup();
            }
            self.popup = new PNotify({
                    title: gettext(title),
                    text: text,
                    type: message_type,
                    hide: false
            });
        }

        self.closePopup = function() {
            if (self.popup !== undefined) {
                self.popup.remove();
            }
        };
    }

    OCTOPRINT_VIEWMODELS.push([
        EepromRepetierViewModel,
        ["controlViewModel", "connectionViewModel"],
        "#settings_plugin_eeprom_repetier"
    ]);
});
