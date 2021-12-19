<!--This is the product card with individual details of a chosen product-->

<script>
  import {products, cart} from "../stores.js";
  import Cart from "./Cart.svelte";  
  import Button from "./Button.svelte";

  export let location;
  
  const addToCart = (product) => {
    console.log("Added");
		let isFaund = false;
    for (let item of $cart) {
        if(item.id === product.id) {
          product.quantity++;
          //$cart = $cart;
					isFaund = true;
					break;
        }
    }
		if(!isFaund){
			$cart = [...$cart, product];
		}
    
  }
</script>

<style>

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