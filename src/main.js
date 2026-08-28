import * as THREE from 'three';
import './style.css';
import { COLORS } from './config.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

renderer.render(scene, camera);
console.log('[landing-cube] scaffold OK, three r' + THREE.REVISION);
