# coding=utf-8
from __future__ import absolute_import, unicode_literals

### (Don't forget to remove me)
# This is a basic skeleton for your plugin's __init__.py. You probably want to adjust the class name of your plugin
# as well as the plugin mixins it's subclassing from. This is really just a basic skeleton to get you started,
# defining your plugin as a template plugin.
#
# Take a look at the documentation on what other plugin mixins are available.

import octoprint.plugin
import octoprint.server

__plugin_pythoncompat__ = ">=2.7,<4"

class Eeprom_repetierPlugin(octoprint.plugin.AssetPlugin,
                            octoprint.plugin.TemplatePlugin):
    def get_assets(self):
        return dict(
            js=["js/eeprom_repetier.js"]
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

__plugin_name__ = "EEPROM Editor - Repetier"

def __plugin_load__():
    global __plugin_implementation__
    __plugin_implementation__ = Eeprom_repetierPlugin()

    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }

