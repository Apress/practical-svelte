# Notes

To launch mini site (to show pages) you have to do additional steps.

- Add `hydratable: true` option for working with `svelte-inline-svg` plug-in.
```
	plugins: [
		svelte({
			compilerOptions: {
				// enable run-time checks when not in production
				hydratable: true,
				dev: !production
			}
		}),
```		

- Fill in `stores.js` file. Add items indirectly added in the Svelte components.

```
import { writable } from "svelte/store";

export let cart = writable([]);

export let products = writable([]);
export let counter = writable(0);
```