import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import { arrayify, get } from 'appcd-util';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { exe } from 'appcd-subprocess';
import { genymotion, virtualbox } from 'androidlib';

const VIRTUALBOX_CONFIG = 1;
const VM_CONFIG = 2;

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
					// Squelch
				}
			},
			depth:                1,
			exe:                  `vboxmanage${exe}`,
			multiple:             false,
			name:                 'virtualbox',
			paths:                virtualbox.virtualBoxLocations[process.platform],
			redetect:             true,
			refreshPathsInterval: 15000,
			registryKeys: {
				hive: 'HKLM',
				key: 'Software\\Oracle\\VirtualBox',
				name: 'InstallDir'
			},
			watch:                true
		});

		const refreshVirtualBoxEmulators = () => {
			const vms = this.virtualbox.list();

			appcd.fs.watch({
				type:     VM_CONFIG,
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

		const vboxConfig = virtualbox.virtualBoxConfigFile[process.platform];
		appcd.fs.watch({
			type: VIRTUALBOX_CONFIG,
			paths: [ vboxConfig ],
			debounce: true,
			handler() {
				console.log(`${vboxConfig} changed, rescanning genymotion emulators`);
				refreshVirtualBoxEmulators();
			}
		});

		await this.vboxEngine.start();
	}

	/**
	 * Detects Genymotion and its emulators.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initGenymotion() {
		const paths = arrayify(get(this.config, 'android.genymotion.searchPaths'), true).concat(genymotion.genymotionLocations[process.platform]);

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
			paths,
			processResults: results => {
				for (const r of results) {
					r.virtualbox = this.virtualbox || {};
				}
			},
			redetect: true,
			watch:    true
		});

		this.genyEngine.on('results', async (results) => {
			gawk.set(this.data, results);
		});

		await this.genyEngine.start();
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
