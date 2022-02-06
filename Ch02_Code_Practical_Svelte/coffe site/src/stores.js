import { writable } from "svelte/store";

export let cart = writable([]);

export let products = writable([]);
export let counter = writable(0);