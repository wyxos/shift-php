<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';

const shiftUrl = window.shiftConfig?.loginRoute?.split('/login')[0] || window.location.origin;

</script>
<template>
    <router-view></router-view>
    <AuthErrorModal :redirect-url="shiftUrl" />
</template>
