# GARRIVERSE Character Realism Pipeline

## Why this work exists

The village environment is currently assembled from Babylon.js meshes, but the player and NPCs in `src/game/builders.ts` are also procedural primitives. That makes the people visibly more toy-like than the environment. This branch improves the procedural fallback while defining the path to production-quality human characters.

## Visual target

- Grounded, realistic human proportions and anatomy; avoid block-shaped torsos, cuboid limbs, oversized heads and toy-like eyes.
- Nigerian rural-town context: believable everyday workwear, practical footwear, varied adult characters and culturally appropriate clothing. Do not reduce character identity to stereotypes.
- Natural skin, cloth, hair and footwear materials with physically plausible roughness and lighting.
- Player, farmers, factory workers and market sellers should share one coherent visual quality level.
- Preserve clear silhouettes and readable interactions at the normal third-person camera distance.

## Production asset format

Use rigged `.glb` (glTF 2.0 binary) assets for final player/NPC characters. A final model should include:
- One clean humanoid skeleton with normalized bone weights.
- Separate animation clips or AnimationGroups for `Idle`, `Walk`, `Run`, `Work`, `Carry`, and `Harvest` (where available).
- PBR metallic-roughness materials; base-color, normal and ORM maps packed efficiently.
- Correct real-world scale, forward axis and ground origin; feet should rest at Y=0.
- LODs or simplified meshes for distant NPCs; avoid unnecessary high-poly face details at village camera distance.
- Texture atlases where practical to reduce draw calls and material switches.

## Recommended authoring workflow

1. Create or commission original adult Nigerian characters in Blender or another DCC tool.
2. Use a consistent rig and retargetable animation set. Mixamo may be used as an animation authoring/retargeting step only where its current terms and the source model's licence permit the intended game use.
3. Export to GLB and test in Babylon.js Sandbox before adding it to the game.
4. Store approved models under `public/models/characters/`; keep source project files and licence/attribution notes alongside the asset in the team's asset archive.
5. Record creator, source URL, licence, permitted commercial use, attribution requirements and date checked for every third-party asset. Do not ship assets with unclear or non-commercial-only terms.
6. Integrate the model behind a loader/fallback boundary so missing or failed assets never prevent the world from starting.

## Mobile performance budget (initial targets, to validate on real Android devices)

- Player character: aim for 25k–45k triangles for the highest LOD; lower LODs for NPCs.
- NPCs: share materials and skeleton/animation data where possible; use instancing only for compatible static pieces, not skinned character meshes.
- Keep character textures to 1K where possible; reserve 2K for the player only if measured memory allows.
- Limit real-time shadow casters. Prefer a small number of important shadow casters and baked/ambient shading for distant NPCs.
- Test on low/mid-range Android WebGL devices; measure frame time, draw calls, GPU memory and loading time before raising quality.
- Respect device pixel ratio and provide quality tiers rather than forcing desktop-quality settings on mobile.

## Current implementation in this branch

- Replaced the previous box-limbed procedural humanoid with smoother, rounded anatomy, more natural body proportions, and additional face/ear/hand/foot detail.
- Kept the existing `Humanoid` transform contract so player movement, NPC routes, and work/walk animation remain compatible.
- This is an interim visual improvement, **not photorealism**. Final realism depends on adding properly licensed, rigged GLB human assets and validating them in the actual game.

## Acceptance checks

- `npm run build` and `npm run typecheck` pass.
- Player and NPC movement/animation still work; no detached limbs or broken shadows.
- Factory workers remain in their work poses.
- Touch controls, camera and embed route are unchanged.
- Test at desktop and Android viewport sizes; compare frame rate and loading time.
- No production deploy, database migration or main-branch merge until explicitly approved.
