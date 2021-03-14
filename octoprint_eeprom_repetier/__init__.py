# coding=utf-8
from __future__ import absolute_import, unicode_literals

import octoprint.plugin
import octoprint.server
import flask
from flask.json import jsonify

import io
import json
import os
import time

__plugin_name__ = "EEPROM Editor - Repetier"

__plugin_pythoncompat__ = ">=2.7,<4"

BACKUP_FILE_PREFIX = "eeprom-backup"
BACKUP_FILE_EXTENSION = ".repr"

BACKUP_DATE_TIME_FMT = "%Y%m%d-%H%M%S"

def build_backup_filename():
    return "{}-{}{}".format(BACKUP_FILE_PREFIX, time.strftime(BACKUP_DATE_TIME_FMT), BACKUP_FILE_EXTENSION)


class Eeprom_repetierPlugin(octoprint.plugin.AssetPlugin,
                            octoprint.plugin.TemplatePlugin,
                            octoprint.plugin.BlueprintPlugin):
    def get_assets(self):
        return dict(
            js=["js/eeprom_repetier.js"],
            css=["css/eeprom_repetier.css"]
        )

    def get_template_configs(self):
        return [
            dict(type="settings", template="eeprom_repetier_settings.jinja2", custom_bindings=True)
        ]

    def get_update_information(self):
        return dict(
            eeprom_repetier=dict(
                displayName="EEPROM Repetier Editor Plugin",
                displayVersion=self._plugin_version,

                # version check: github repository
                type="github_release",
                user="Salandora",
                repo="OctoPrint-EEPROM-Repetier",
                current=self._plugin_version,

                # update method: pip
                pip="https://github.com/Salandora/OctoPrint-EEPROM-Repetier/archive/{target_version}.zip"
            )
        )

    ## Environment methods
    def get_backup_folder(self):
        return self.get_plugin_data_folder()

    def get_full_path(self, filename):
        return os.path.realpath(os.path.join(self.get_backup_folder(), filename))

    def get_file_url(self, filename):
        return flask.url_for("index") + "plugin/eeprom_repetier/download/" + filename

    ## BlueprintPlugin
    @octoprint.plugin.BlueprintPlugin.route("/list", methods=["GET"])
    def get_list(self):
        backup_folder = self.get_backup_folder()

        dir_list = os.listdir(backup_folder)
        backup_list = [{"filename":item, "url":self.get_file_url(item)} for item in dir_list if item.endswith(BACKUP_FILE_EXTENSION)]
        response = flask.jsonify(
            info = "Backup files", files = backup_list
        )
        response.status_code = 200
        return response

    @octoprint.plugin.BlueprintPlugin.route("/backup", methods=["POST"])
    def create_backup(self):
        filename = build_backup_filename()
        full_path = self.get_full_path(filename)
        backup_data = flask.request.json
        response_status = 201

        try:
            file = open(full_path,"w")
            file.write(json.dumps(backup_data, indent=2))
            file.close()
            self._logger.info("Created new EEPROM backup {}".format(filename))
        except Exception:
            self._logger.exception("Could not create EEPROM backup file {}".format(filename))
            response_status = 500

        response = flask.jsonify(name=filename)
        response.status_code = response_status
        return response

    @octoprint.plugin.BlueprintPlugin.route("/backup/<filename>", methods=["GET"])
    def get_backup(self, filename):
        full_path = self.get_full_path(filename)
        data = ""
        response_status = 200

        if (os.path.exists(full_path)):
            try:
                file = open(full_path,"r")
                data = file.read()
                file.close()
                self._logger.info("Read EEPROM backup {}".format(filename))
            except Exception:
                self._logger.exception("Could not read {}".format(filename))
                response_status = 404
                #raise
        else:
            self._logger.warning("Requested backup file {} not found.".format(filename))
            response_status = 204

        response = flask.jsonify(name=filename, data=data)
        response.status_code = response_status
        return response

    @octoprint.plugin.BlueprintPlugin.route("/backup/<filename>", methods=["DELETE"])
    def delete_backup(self, filename):
        backup_folder = self.get_backup_folder()
        full_path = self.get_full_path(filename)
        response_status = 200

        if (os.path.exists(full_path)):
            try:
                os.remove(full_path)
                self._logger.info("Deleted EEPROM backup {}".format(filename))
            except Exception:
                self._logger.exception("Could not delete {}".format(filename))
                response_status = 404
                #raise
        else:
            self._logger.warning("Backup file {} not found.".format(filename))

        response = flask.jsonify(name=filename, data=[])
        response.status_code = response_status
        return response

    ## tornado hooks for static file download
    def route_hook(self, *args, **kwargs):
        from octoprint.server import app
        from octoprint.server.util.tornado import LargeResponseHandler

        return [
            (
                r"/download/(.*)",
                LargeResponseHandler,
                {
                    "path": self.get_plugin_data_folder(),
                    "as_attachment": True
                },
            )
        ]


def __plugin_load__():
    global __plugin_implementation__
    __plugin_implementation__ = Eeprom_repetierPlugin()

    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.server.http.routes": __plugin_implementation__.route_hook,
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }

