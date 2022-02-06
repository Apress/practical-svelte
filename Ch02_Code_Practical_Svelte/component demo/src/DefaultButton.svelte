<script>
	export let buttonAction = () => alert('Welcome to the world of Svelte!');
</script>

<button on:click={buttonAction}>
	<slot>Hello World</slot>
</button>

<style>
	button {
		color: #FFCC00;
		background-color: #333;
		border-radius: 5px;
		padding: 8px;
		border: none;
		font-size: 20px;
	}
</style>