const getStore = () => cy.window().its('app.store')

describe('Testing stores in app', () => {
  it('can render correct value from product listing', () => {
    getStore().then(store => {
      store.set({ name: 'xxxxxx' })
    })

    cy.contains('XXX', 'XXXXXX!')
  })
})