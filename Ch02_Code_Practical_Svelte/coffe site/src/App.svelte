<script>
	import { Products, Footer, Header, Product, CartLength, Cart } from "./components";
	import About from "./pages/About.svelte";
	import Home from "./pages/Home.svelte";
	import Coffee from "./pages/Coffee.svelte";
	import { Router, Link, Route } from "svelte-routing";
	import {products, cart, counter } from "./stores.js";
	export let url = "";
	</script>

<Header />
<Router url="{url}">
	<nav>
		<Link to="/">Home</Link>
		<Link to="/products">Shop</Link>
		<Link to="/about">Our Story</Link>
		<Link to="/coffee">Our Coffee</Link>
	</nav>

	<main>
		<Route path="/" component="{Home}" />
		<Route path="products" component="{Products}" />
		<Route path="about" component="{About}" />
		<Route path="coffee" component="{Coffee}" />
		<Route path="/product/:id" component="{Product}" />
	</main>
</Router>
<Footer />


<style>
	
</style>