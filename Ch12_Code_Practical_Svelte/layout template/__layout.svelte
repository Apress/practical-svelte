<script>
  import Header from '../components/Header.svelte';
  import Footer from '../components/Footer.svelte';
  import Disclaimer from '../components/Disclaimer.svelte';
</script>

<Header />
<Disclaimer />
  <nav>
    <ul>
      <li><a href="/.">Home</a></li>
      <li><a href="/Products">Shop</a></li>
      <li><a href="/About">About</a></li>
      <li><a href="/Coffee">Coffee</a></li>
      <li><a href="/Contact">Contact</a></li> 
    </ul>
  </nav>
  <main>
    <slot />
  </main>
<Footer />
