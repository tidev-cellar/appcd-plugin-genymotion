import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import { arrayify, get, mergeDeep } from 'appcd-util';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { exe } from 'appcd-subprocess';
import * as androidlib from 'androidlib';

const { genymotion, virtualbox } = androidlib;

/**
 * The Genymotion and VirtualBox info service.
 */
export default class GenymotionInfoService extends DataServiceDispatcher {
	/**
	 * Starts the detect all Genymotion and VirtualBox service.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;
		if (cfg.android) {
			mergeDeep(androidlib.options, cfg.android);
		}
		gawk.watch(cfg, 'android', () => mergeDeep(androidlib.options, cfg.android || {}));

		this.virtualbox = null;

		this.data = gawk({
			emulators: [],
			executables: {},
			home: null,
			path: null,
			version: null,
			virtualbox: null
		});

		await this.initVirtualBox();
		await this.initGenymotion();
	}

	/**
	 * Detects where VirtualBox is installed.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initVirtualBox() {
		this.vboxEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new virtualbox.VirtualBox(dir);
				} catch (e) {
					// 'dir' does not contain VirtualBox
				}
			},
			depth:    1,
			exe:      `vboxmanage${exe}`,
			multiple: false,
			name:     'virtualbox',
			paths: [
				...arrayify(get(this.config, 'android.virtualbox.searchPaths'), true),
				...virtualbox.virtualBoxLocations[process.platform]
			],
			redetect: true,
			registryKeys: {
				key: 'HKLM\\Software\\Oracle\\VirtualBox',
				name: 'InstallDir'
			},
			watch:    true
		});

		const refreshVirtualBoxEmulators = () => {
			const vms = this.virtualbox.list();

			appcd.fs.watch({
				type:     'vmconf',
				paths:    vms.map(vm => path.join(vm.path, `${vm.name}.vbox`)),
				debounce: true,
				handler() {
					console.log('A virtual machine config changed, rescanning genymotion emulators');
					refreshVirtualBoxEmulators();
				}
			});

			const emulators = vms
				.filter(vm => vm.props.genymotion_version)
				.map(vm => new genymotion.GenymotionEmulator(vm));

			gawk.set(this.data.emulators, emulators, (dest, src) => {
				return dest && src && dest.path === src.path;
			});
		};

		this.vboxEngine.on('results', vbox => {
			this.virtualbox = vbox;
			refreshVirtualBoxEmulators();
		});

		await this.vboxEngine.start();

		const watchConfig = async value => {
			await appcd.fs.unwatch('vboxconf');

			const vboxConfig = value || virtualbox.virtualBoxConfigFile[process.platform];
			await appcd.fs.watch({
				type: 'vboxconf',
				paths: [ vboxConfig ],
				debounce: true,
				handler() {
					console.log(`${vboxConfig} changed, rescanning genymotion emulators`);
					refreshVirtualBoxEmulators();
				}
			});
		};

		await watchConfig(get(this.config, 'android.virtualbox.configFile'));
		gawk.watch(this.config, [ 'android', 'virtualbox', 'configFile' ], watchConfig);

		gawk.watch(this.config, [ 'android', 'virtualbox', 'searchPaths' ], value => {
			this.vboxEngine.paths = [
				...arrayify(value, true),
				...virtualbox.virtualBoxLocations[process.platform]
			];
		});
	}

	/**
	 * Detects Genymotion and its emulators.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initGenymotion() {
		this.genyEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new genymotion.Genymotion(dir);
				} catch (e) {
					// squelch
				}
			},
			depth:    1,
			exe:      `genymotion${exe}`,
			multiple: false,
			name:     'genymotion',
			paths: [
				...arrayify(get(this.config, 'android.genymotion.searchPaths'), true),
				...genymotion.genymotionLocations[process.platform]
			],
			processResults: results => {
				for (const r of results) {
					r.virtualbox = this.virtualbox || {};
				}
			},
			redetect: true,
			watch:    true
		});

		this.genyEngine.on('results', results => gawk.set(this.data, results));

		await this.genyEngine.start();

		gawk.watch(this.config, [ 'android', 'genymotion', 'searchPaths' ], value => {
			this.genyEngine.paths = [
				...arrayify(value, true),
				...genymotion.genymotionLocations[process.platform]
			];
		});
	}

	/**
	 * Stops the Genymotion-related environment watchers.
	 *
	 * @access public
	 */
	async deactivate() {
		if (this.genyEngine) {
			await this.genyEngine.stop();
			this.genyEngine = null;
		}

		if (this.vboxEngine) {
			await this.vboxEngine.stop();
			this.vboxEngine = null;
		}

		if (this.subscriptions) {
			for (const type of Object.keys(this.subscriptions)) {
				await appcd.fs.unwatch(type);
			}
		}

		if (this.refreshDeployPathTimer) {
			clearTimeout(this.refreshDeployPathTimer);
			this.refreshDeployPathTimer = null;
		}
	}
}
