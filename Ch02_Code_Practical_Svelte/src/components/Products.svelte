<script>
  import {products, cart} from "../stores.js";
  import Cart from "./Cart.svelte";  
  import Button from "./Button.svelte";

  export let location;
  
  const addToCart = (product) => {
    console.log("Added");
    for (let item of $cart) {
        if(item.id === product.id) {
          product.quantity += 1
          $cart = $cart;
          return;
        }
    }
    $cart = [...$cart, product]
  }
</script>

<style>
…TO BE ADDED LATER…
</style>


<div class="product-list">
  {#each $products as product}
    <div>
      <div class="image" style="background-image: url({product.image})"></div>
      <h4><a href="product/{product.id}">{product.name}</a></h4>
      <div class="cta">
        <p>${product.price}</p>
        <Button on:click={() => addToCart(product)}>
          Add to cart
        </Button>
      </div>
    </div>
  {/each}
</div>
<Cart />