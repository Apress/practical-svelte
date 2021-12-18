<script>
  import { cart } from "../stores.js";
  
  const removeItem = (product) => {
    for(let item of $cart) {
      if(item.id === product.id) {
        if(product.quantity > 1 ) {
          product.quantity -= 1
          $cart = $cart
        } else {
          $cart = $cart.filter((cartItem) => cartItem != product)
        }
        return;
      }
    }
  }
  
  const addItem = (product) => {
    for(let item of $cart) {
      if(item.id === product.id) {
        product.quantity += 1
        $cart = $cart;
        return;
      }
    }
  }

  $: total = $cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
</script>

<style>
…TO BE ADDED LATER…
</style>

<div class="cart-list">
<span class="title">Cart</span>
  <div class="total">
    <h4>Total: $ {total}</h4>
  </div>  
  {#each $cart as item }
    {#if item.quantity > 0}
    <div class="cart-item">
      <img width="50" src={item.image} alt={item.name}/>
      <span>{item.name}</span>
      <div>{item.quantity}
        <button on:click={() => addItem(item)}>+</button>
        <button on:click={() => removeItem(item)}>-</button>
      </div>
      <span>${item.price * item.quantity}</span>
    </div>
    {/if}
  {/each}
</div>

