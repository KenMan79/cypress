import React from 'react'
import { SelectWizard } from './components/SelectWizard'
import { testingTypes } from './types/shared'

export const SpringboardApp = (props) => {
  const { currentStep } = props
  const goBack = () => {}
  const goNext = () => {}

  return (
    <div className="h-150 max-w-200 mx-auto rounded-xl bg-white relative">
      <div>
        <div className="flex justify-between p-2 bg-gray-900 text-white">
          Cypress Dashboard
          <button>Log in</button>
        </div>
        <div className="flex flex-col justify-center h-120 p-2">
          {!currentStep ? (
            <SelectWizard testingTypes={testingTypes} showNewUserFlow />
          ) : (
            currentStep.component
          )}
        </div>
      </div>

      <div className="text-right absolute bottom-2 right-2">
        <button
          className={`text-blue-500 m-5 px-4 py-2 rounded border-blue-500 border-1 border-inset ${
            !currentStep ? 'invisible' : ''
          }`}
          onClick={goBack}
        >
          Previous Step
        </button>

        <button
          disabled={!props.selectedTestingType || !props.canGoNextStep}
          data-cy="previous"
          className={`bg-blue-500 text-white m-5 px-4 py-2 rounded ${
            !props.selectedTestingType || !props.canGoNextStep
              ? 'opacity-50'
              : ''
          }`}
          onClick={goNext}
        >
          {props.nextStepText}
        </button>
      </div>
    </div>
  )
}

// <script lang="ts">
// import { provideApolloClient } from '@vue/apollo-composable'
// import { apolloClient } from './graphql/apolloClient'
// import { computed, defineComponent, markRaw, ref } from 'vue'
// import { testingTypes } from './types/shared'
// import RunnerButton from './components/RunnerButton.vue'
// import SelectWizard from './components/SelectWizard.vue'
// import { wizards } from './wizards/wizards'
// import { useStore } from './store'

// export default defineComponent({
//   name: 'App',

//   components: {
//     RunnerButton,
//     SelectWizard,
//   },

//   setup() {
//     provideApolloClient(apolloClient)
//     const store = useStore()

//     const currentStepNumber = ref<number>(0)

//     const selectedWizard =  computed(() =>
//       store.getState().testingType
//         ? wizards[store.getState().testingType!]
//         : undefined
//     )

//     const goNext = () => {
//       if (!selectedWizard.value || currentStepNumber.value === selectedWizard.value.steps.length) {
//         // we are done!
//         // launch browser, or whatever
//         return
//       }

//       currentStepNumber.value += 1
//     }

//     const goBack = () => {
//       if (currentStepNumber.value > 0) {
//         currentStepNumber.value -= 1
//       }
//     }

//     const lastStepOfWorkflow = computed(() => {
//       return selectedWizard.value &&
//         selectedWizard.value.steps.length <= currentStepNumber.value
//     })

//     const nextStepText = computed(() => {
//       if (lastStepOfWorkflow.value) {
//         return 'Launch'
//       }

//       return 'Next Step'
//     })

//     const currentStep = computed(() => selectedWizard.value ? selectedWizard.value.steps[currentStepNumber.value - 1] : undefined)

//     return {
//       testingTypes: markRaw(testingTypes),
//       selectedWizard,
//       canGoNextStep: computed(() => currentStep.value ? currentStep.value.canGoNextStep() : !!selectedWizard.value),
//       nextStepText,
//       currentStep,
//       goNext,
//       goBack,
//       selectedTestingType: computed(() => store.getState().testingType)
//     }
//   }
// })
// </script>