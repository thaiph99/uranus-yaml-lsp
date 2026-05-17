use std::{env, fs};
use zed_extension_api::{self as zed, LanguageServerId, Result};

const BINARY_NAME: &str = "uranus-yaml-lsp";
const PACKAGE_NAME: &str = "@uranus-yaml/lsp-server";
const SERVER_PATH: &str = "node_modules/@uranus-yaml/lsp-server/bin/uranus-yaml-lsp";

struct UranusYamlExtension {
    cached_server_path: Option<String>,
}

impl UranusYamlExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).is_ok_and(|metadata| metadata.is_file())
    }

    fn server_script_path(&mut self, language_server_id: &LanguageServerId) -> Result<String> {
        if self.cached_server_path.is_some() && self.server_exists() {
            return Ok(SERVER_PATH.to_string());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        let latest_version = zed::npm_package_latest_version(PACKAGE_NAME)?;
        if !self.server_exists()
            || zed::npm_package_installed_version(PACKAGE_NAME)?.as_ref() != Some(&latest_version)
        {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );

            let install_result = zed::npm_install_package(PACKAGE_NAME, &latest_version);
            match install_result {
                Ok(()) => {
                    if !self.server_exists() {
                        Err(format!(
                            "installed package '{PACKAGE_NAME}' did not contain expected path '{SERVER_PATH}'"
                        ))?;
                    }
                }
                Err(error) => {
                    if !self.server_exists() {
                        Err(error)?;
                    }
                }
            }
        }

        Ok(SERVER_PATH.to_string())
    }
}

impl zed::Extension for UranusYamlExtension {
    fn new() -> Self {
        Self {
            cached_server_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        if let Some(path) = worktree.which(BINARY_NAME) {
            return Ok(zed::Command {
                command: path,
                args: vec!["--stdio".to_string()],
                env: Default::default(),
            });
        }

        let server_path = env::current_dir()
            .unwrap()
            .join(self.server_script_path(language_server_id)?)
            .to_string_lossy()
            .to_string();
        self.cached_server_path = Some(server_path.clone());

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(UranusYamlExtension);
