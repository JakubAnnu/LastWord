import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

/**
 * Walking Mannequin Actor
 * - Starts at position x=-1.45603, y=3.36, z=1.62
 * - Plays idle animation for 2 seconds
 * - Walks to position x=2.01, y=3.36, z=1.62
 * - Stops and plays idle animation again
 */
@ENGINE.GameClass()
export class WalkingMannequinActor extends ENGINE.Actor {
  private gltfComponent!: ENGINE.GLTFMeshComponent;
  private animationComponent!: ENGINE.AnimationComponent;
  
  private startPosition = new THREE.Vector3(-1.45603, 3.36, 1.62);
  private targetPosition = new THREE.Vector3(2.01, 3.36, 1.62);
  
  private walkStartTime = 2.0; // Start walking after 2 seconds
  private walkDuration = 3.5; // Duration of the walk (adjust based on distance)
  
  private currentState: 'idle-start' | 'walking' | 'idle-end' = 'idle-start';
  private elapsedTime = 0;
  private walkStartElapsed = 0;
  
  private idleClipName: string | null = null;
  private walkClipName: string | null = null;
  private hasAnimations = false;

  public override initialize(): void {
    super.initialize();
    
    // Set initial position
    this.setWorldPosition(this.startPosition);
    
    // Calculate walk direction and look at target
    const direction = new THREE.Vector3()
      .subVectors(this.targetPosition, this.startPosition)
      .normalize();
    
    // Make the mannequin face the direction of movement
    const angle = Math.atan2(direction.x, direction.z);
    this.setWorldRotation(new THREE.Euler(0, angle, 0));
    
    // Create GLTF mesh component with mannequin model
    // Alternative models to try:
    // - '@engine/assets/character/mannequinG.glb'
    // - '@engine/assets/character/SKM_SB_MediumHuman.glb'
    // - '@engine/assets/models/demo/SandboxAsset/Characters/SKM_SB_MediumHuman.glb'
    this.gltfComponent = ENGINE.GLTFMeshComponent.create({
      name: 'MannequinMesh',
      modelUrl: '@engine/assets/models/demo/SandboxAsset/Characters/SKM_SB_MediumHuman.glb',
    });
    
    this.rootComponent.add(this.gltfComponent);
    
    // Log available animations when model loads
    this.gltfComponent.onMeshLoaded.add(() => {
      const animations = this.gltfComponent.getAnimations();
      console.log('=== MANNEQUIN ANIMATIONS ===');
      console.log('Available animations:', animations.map(anim => anim.name));
      console.log('Total animations found:', animations.length);
      
      if (animations.length === 0) {
        console.warn('⚠️ No animations found in this model! Model is static (T-pose).');
        this.hasAnimations = false;
        return;
      }
      
      this.hasAnimations = true;
      
      // Try to find idle and walk animations by name (case-insensitive)
      for (const anim of animations) {
        const nameLower = anim.name.toLowerCase();
        
        // Look for idle animation
        if (!this.idleClipName && (
          nameLower.includes('idle') || 
          nameLower.includes('stand')
        )) {
          this.idleClipName = anim.name;
          console.log(`✅ Found IDLE animation: "${this.idleClipName}"`);
        }
        
        // Look for walk animation
        if (!this.walkClipName && (
          nameLower.includes('walk') || 
          nameLower.includes('run')
        )) {
          this.walkClipName = anim.name;
          console.log(`✅ Found WALK animation: "${this.walkClipName}"`);
        }
      }
      
      // If we found an idle animation, start playing it
      if (this.idleClipName) {
        console.log(`▶️ Starting idle animation: "${this.idleClipName}"`);
        this.animationComponent.playAnimation(this.idleClipName, 0);
      } else if (animations.length > 0) {
        // Fallback: use first animation
        this.idleClipName = animations[0].name;
        console.log(`⚠️ No idle animation found, using first animation: "${this.idleClipName}"`);
        this.animationComponent.playAnimation(this.idleClipName, 0);
      }
      
      if (!this.walkClipName) {
        console.warn('⚠️ No walk animation found. Character will slide without animation.');
      }
    });
    
    // Create animation component
    this.animationComponent = ENGINE.AnimationComponent.create({
      name: 'MannequinAnimation',
      autoPlay: false, // Don't auto-play until we know the clip names
      loopMode: 'LoopRepeat',
    });
    
    this.rootComponent.add(this.animationComponent);
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    
    this.elapsedTime += deltaTime;
    
    switch (this.currentState) {
      case 'idle-start':
        // Wait for 2 seconds in idle
        if (this.elapsedTime >= this.walkStartTime) {
          this.startWalking();
        }
        break;
        
      case 'walking':
        // Move towards target position
        this.walkStartElapsed += deltaTime;
        const walkProgress = Math.min(this.walkStartElapsed / this.walkDuration, 1.0);
        
        // Interpolate position
        const currentPos = new THREE.Vector3().lerpVectors(
          this.startPosition,
          this.targetPosition,
          walkProgress
        );
        this.setWorldPosition(currentPos);
        
        // Check if reached target
        if (walkProgress >= 1.0) {
          this.stopWalking();
        }
        break;
        
      case 'idle-end':
        // Stay in idle (do nothing)
        break;
    }
  }
  
  private startWalking(): void {
    if (!this.hasAnimations || !this.walkClipName) {
      console.log('Mannequin starts walking (no walk animation available)');
      this.currentState = 'walking';
      this.walkStartElapsed = 0;
      return;
    }
    
    console.log(`Mannequin starts walking with animation: "${this.walkClipName}"`);
    this.currentState = 'walking';
    this.walkStartElapsed = 0;
    
    // Switch to walk animation
    this.animationComponent.playAnimation(this.walkClipName, 0.3);
  }
  
  private stopWalking(): void {
    if (!this.hasAnimations || !this.idleClipName) {
      console.log('Mannequin stops walking (no idle animation available)');
      this.currentState = 'idle-end';
      return;
    }
    
    console.log(`Mannequin stops walking, switching to idle: "${this.idleClipName}"`);
    this.currentState = 'idle-end';
    
    // Switch back to idle animation
    this.animationComponent.playAnimation(this.idleClipName, 0.3);
  }
}
