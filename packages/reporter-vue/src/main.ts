import './main.scss'
import App from './App.vue'
import VTooltip from 'v-tooltip'
import _ from 'lodash'
export const plugins = [
  VTooltip
]
// The setup function is called within the support file
// When there are plugins, like a Store or Router, add them here so that
// they're picked up by the tests and properly setup.
export async function setup(createApp = true) {

  // Global CSS imports.
  import('virtual:windi.css')
  // import('virtual:windi.css')

  // @ts-ignore
  // For devtools only, will be automatically stripped out in production
  import('virtual:windi-devtools')

  // Cypress Component Test utils will set the app up on its own
  // Only need to do this when mounting this like an App
  if (createApp) {
    const { createApp }  = await import('vue')
    const app = createApp(App)
    _.forEach(plugins, plugin => app.use(plugin))
    app.mount('#app')
  }
  return { root: App, plugins }
}

setup()


