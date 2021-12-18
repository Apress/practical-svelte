import Disclaimer from '../../components/Disclaimer.svelte'
import Header from '../../components/Header.svelte'
import Homepage from '../../pages/Home.svelte'
import Footer from '../../components/Footer.svelte'

import { setContext } from "svelte"
import { mount } from 'cypress-svelte-unit-test'

describe('Run tests for Homepage', () => {
  it('shows disclaimer at top of site', () => {
    mount(Disclaimer, {
      props: {
        name: 'World',
      },
    })

    cy.contains('span', 'This is a test site only')
  })
  
  it('header contains correct title', () => {
    cy.reload()
    cy.visit('http://localhost:5000')
    cy.get('div.modal > div:nth-child(1) > button').click()

    cy.get('header > div > span:nth-child(2)').should('have.length', 1)
    cy.contains('header > div > span:nth-child(2)', 'Small Coffee Company')
  })
  
  it('homepage should show 3 new arrivals', () => {
    mount(Homepage, {
      props: {
        title: 'New Arrivals',
      },
    })
    
    cy.get('button').click()
    cy.get('#newarrivals img').should('have.length', 3)
    cy.get('span.welcome').contains('New Arrivals')
  })
  
  it('footer should have 3 social media icons', () => {
    mount(Footer, {
      props: {
        name: 'World',
      },
    })
  
    let reference = 'footer > div:nth-child(2) > span > a'

    cy.get(reference).should('have.length', 3)
    cy.get(reference + ':nth-child(1)').should('have.attr', 'href').and('include', 'https://facebook.com/smallcoffeecompany') // Facebook
    cy.get(reference + ':nth-child(2)').should('have.attr', 'href').and('include', 'https://instagram.com/smallcoffeecompany') // Instagram
    cy.get(reference + ':nth-child(3)').should('have.attr', 'href').and('include', 'https://twitter.com/smallcoffeecompany') // Twitter
  })
  
  it('copyright exists and has correct text', () => {
    mount(Footer, {
      props: {
        name: 'World',
      },
    })

    cy.get('footer > div > span').should.exist
    cy.get('footer > div > span').contains('© Small Coffee Company 2021')
  })
})


