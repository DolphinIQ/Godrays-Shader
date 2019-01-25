var canvas = document.getElementById("myCanvas");
let btnSwitch = document.querySelector(".btn");
var camera0, scene0, renderer, controls, clock, composer, stats, dpr;
let ocl = {
	scene: null,
	camera: null,
	renderTarget: null,
	composer: null,
	materials: [
		new THREE.MeshBasicMaterial({ color: 0x000000 }),
		new THREE.MeshBasicMaterial({ color: 0xffffff }),
	],
};
let godraysPass, addOclPass, bgColPass;
var textureLoader;
var Textures = {};
var Lights = [];
let shadows = true;
let cubes = [];
let sun;
// let pTree;

let camPos = new THREE.Vector3( -40 , 40 , 100 );
let camTarget = new THREE.Vector3( -5 , 0 , 0 );
let mousePos = {};
let sunVisible = true, ray = new THREE.Raycaster();

function init() {
	renderer = new THREE.WebGLRenderer( { canvas: canvas, antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	if(shadows){ 
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.shadowMap.autoUpdate = false;
	}
	
	scene0 = new THREE.Scene();
	// scene0.background = new THREE.Color( 0xd0d0d0 );
	scene0.background = new THREE.Color( 0x909090 );
	// scene0.fog = new THREE.FogExp2( 0xd0d0d0 , 0.0035 );
	
	camera0 = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 10000 );
	// camera0.position.set( 0 , 25 , 40 );
	camera0.position.copy( camPos );
	camera0.lookAt( camTarget );
	
	// OCCLUSION SCENE
	ocl.scene = new THREE.Scene();
	ocl.scene.add( new THREE.AmbientLight( 0xffffff ) );
	
	stats = new Stats();
	document.body.appendChild( stats.dom );
	
	clock = new THREE.Clock();
	textureLoader = new THREE.TextureLoader();

	window.addEventListener( "resize", function(){
		renderer.setSize( window.innerWidth, window.innerHeight );
		camera0.aspect = window.innerWidth / window.innerHeight;
		camera0.updateProjectionMatrix();
	}, false );
	btnSwitch.addEventListener( "click", switchShaderMode, false );
	
	initControls();
	initTextures();
	
	createStartingMesh();
	initLights();
	// pTree = new THREE.Object3D();
	// scene0.add( pTree );
	proceduralTree( new THREE.Vector3( -30 , 0 , 0 ), 20 , 3 , 0.0 );
	
	postProcessing();
	
	renderer.shadowMap.needsUpdate = true;
	requestAnimationFrame( animate );
}

var createStartingMesh = function(){
	var darkMaterial = new THREE.MeshLambertMaterial({color: 0x404040 });
	
	let blocksNum = 20; // 40
	for( let i = 0; i < blocksNum; i++ ){
		
		let width = Math.random()*10 +3;
		let height = Math.random()*30 +5; // *40 + 5
		let depth = Math.random()*10 +3;
		
		// let radius = blocksNum*3.5;
		let radius = 40*3.5;
		let x = Math.random()*radius - radius/2;
		let y = height/2.0;
		let z = Math.random()*radius - radius/2;
		if( x > -40 && x < -20 ) continue;
		
		let geo = new THREE.BoxBufferGeometry( width, height, depth );
		let cube = new THREE.Mesh( geo, darkMaterial );
		cube.position.set( x , y , z );
		if(shadows) cube.castShadow = true;
		
		cubes.push( cube );
		
		scene0.add( cube );
		
		let oclCube = new THREE.Mesh( geo, ocl.materials[0] );
		oclCube.position.set( x , y , z );
		ocl.scene.add( oclCube );
	}
	
	var floor = new THREE.Mesh( 
		new THREE.PlaneBufferGeometry( 1000 , 1000 ),
		new THREE.MeshLambertMaterial({color: 0xc0c0c0})
	);
	floor.rotation.x = -90 * Math.PI/180;
	if(shadows) floor.receiveShadow = true;
	scene0.add( floor );
	
	let oclFloor = floor.clone();
	oclFloor.material = ocl.materials[0];
	ocl.scene.add( oclFloor );
	
	// Sun
	let spriteMat = new THREE.SpriteMaterial({
		map: textureLoader.load( "http://i.imgur.com/Vqv8F4X.png" ),
		transparent: true,
		alphaTest: 0.1,
		color: 0xffffee, // 0xffcc60
	});
	
	let sunGeo = new THREE.SphereBufferGeometry( 50 , 16, 16 );
	let sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
	sun = new THREE.Mesh( sunGeo, sunMat );
	// sun = new THREE.Sprite( spriteMat );
	// sun.scale.multiplyScalar( 100 );
	sun.position.set( 200 , 0 , -1100 );
	scene0.add( sun );
	
	let oclSun = sun.clone();
	oclSun.material = ocl.materials[1];
	ocl.scene.add( oclSun );
}

var postProcessing = function(){
	composer = new THREE.EffectComposer( renderer );
	ocl.renderTarget = new THREE.WebGLRenderTarget( canvas.width/4, canvas.height/4, { format: THREE.RGBFormat, stencilBuffer: false } );
	ocl.composer = new THREE.EffectComposer( renderer, ocl.renderTarget );
	ocl.renderPass = new THREE.RenderPass( ocl.scene, camera0 );
	godraysPass = new THREE.ShaderPass( godraysShader );
	godraysPass.uniforms.fWeight.value = 0.1; // 0.4
	godraysPass.uniforms.fDensity.value = 0.96; // 0.96
	godraysPass.uniforms.fDecay.value = 0.97; // 0.93
	godraysPass.uniforms.fExposure.value = 0.8; // 0.6
	
	let renderPass = new THREE.RenderPass( scene0, camera0 );
	addOclPass = new THREE.ShaderPass( finalFrameShader );
	bgColPass = new THREE.ShaderPass( bgColShader );
	let fxaaPass = new THREE.ShaderPass( THREE.FXAAShader );
	
	let verticalBlurPass = new THREE.ShaderPass( THREE.VerticalBlurShader );
	let horizontalBlurPass = new THREE.ShaderPass( THREE.HorizontalBlurShader );
	let bluriness = 3;
	verticalBlurPass.uniforms[ "v" ].value = bluriness / canvas.width;
	horizontalBlurPass.uniforms[ "h" ].value = bluriness / canvas.height;
	
	ocl.composer.addPass( ocl.renderPass );
	ocl.composer.addPass( godraysPass );
	ocl.composer.addPass( verticalBlurPass );
	ocl.composer.addPass( horizontalBlurPass );
	ocl.composer.addPass( verticalBlurPass );
	ocl.composer.addPass( horizontalBlurPass );
	
	composer.addPass( renderPass );
	composer.addPass( addOclPass );
	composer.addPass( bgColPass );
	composer.addPass( fxaaPass );
	
	fxaaPass.renderToScreen = true; // on the last pass
}

var initControls = function(){
	// controls = new THREE.OrbitControls( camera0 );
	window.addEventListener( "mousemove", function(evt){
		// get mouse screen position from -1 to 1
		mousePos.x = evt.clientX/canvas.width * 2 - 1;
		mousePos.y = evt.clientY/canvas.height * 2 - 1;
	}, false );
	
	controls = {
		speedScale: 0.1,
		radius: 25, // 15
		updateCamera: function( cam ){
			if( mousePos.x != undefined && mousePos.y != undefined ){
				let destinationX = camPos.x + mousePos.x * controls.radius;
				let destinationY = camPos.y - mousePos.y * controls.radius;
				let destVec2 = new THREE.Vector2( destinationX, destinationY );
				let camVec2 = new THREE.Vector2( cam.position.x, cam.position.y );
				
				let distance = new THREE.Vector2(
					destVec2.x - camVec2.x,
					destVec2.y - camVec2.y
				);
				cam.position.x += distance.x * controls.speedScale;
				cam.position.y += distance.y * controls.speedScale;
			} else return;
		}
	};
}

let checkIfSunIsVisible = function(){
	let dirToSunFromCam = sun.position.clone().sub( camera0.position );
	dirToSunFromCam.normalize();
	ray.set( camera0.position , dirToSunFromCam );
	let intersects = ray.intersectObjects( cubes );
	
	if( intersects.length == 0 ){
		sunVisible = true;
	} else {
		sunVisible = false;
		// console.log( intersects[0] );
	}
}

let switchShaderMode = function( evt ){
	bgColPass.uniforms.isON.value = !bgColPass.uniforms.isON.value;
	godraysPass.uniforms.allWhite.value = !godraysPass.uniforms.allWhite.value;
	
	if( godraysPass.uniforms.allWhite.value === true ){
		godraysPass.uniforms.fDecay.value = 0.94; // 0.93
		godraysPass.uniforms.fExposure.value = 0.6; // 0.6
		btnSwitch.textContent = "Sun Shader ->";
	} else {
		godraysPass.uniforms.fDecay.value = 0.97; // 0.93
		godraysPass.uniforms.fExposure.value = 0.8; // 0.6
		btnSwitch.textContent = "Pure Godrays ->";
	}
}

var initTextures = function(){
	
}

var initLights = function(){
	Lights[0] = new THREE.AmbientLight( 0xffffff , 0.17 ); // 0.2
	Lights[1] = new THREE.PointLight( 0xffffff , 1.2 ); // 1.0
	Lights[1].position.copy( sun.position );
	Lights[1].position.x += 15;
	if(shadows){
		Lights[1].castShadow = true;
		Lights[1].shadow.mapSize.width = 1024 * 2;
		Lights[1].shadow.mapSize.height = 1024 * 2;
		Lights[1].shadow.camera.near = 0.1;
		Lights[1].shadow.camera.far = 10000;
		Lights[1].shadow.bias = 0.0001;
	}
	
	Lights[2] = new THREE.PointLight( 0xffffff , 0.2 );
	Lights[2].position.set( 30 , 200, 100 );
	
	for(var i = 0; i < Lights.length; i++){
		scene0.add( Lights[i] );
	}
}

let barkMat = new THREE.MeshLambertMaterial({
	color: 0x404040, 
});
let proceduralTree = function( pos, len, rad, i, _parentTree ){
	
	let pTree;
	if( i > 5.0 ) return;
	
	// radius top, rad bottom, height
	let barkGeo = new THREE.CylinderBufferGeometry( rad*0.7, rad, len, 8 );
	let branch = new THREE.Mesh( barkGeo, barkMat );
	
	if( i === 0.0 ){ // first one
		pTree = new THREE.Object3D();
		scene0.add( pTree );
		pTree.add( branch );
	} else {
		_parentTree.add( branch );
	}
	
	// console.log( branch );
	if(shadows) branch.castShadow = true;
	branch.geometry.translate( 0 , len/2.0 , 0 );
	branch.position.copy( pos );
	
	let randRot;
	let rtmx;
	if( i != 0.0 ) {
		let randFac = 3.0; // 3.0
		randRot = Math.random()*randFac - randFac/2.0;
		if( randRot > -0.5 && randRot < 0.5 ) randRot = Math.random()*randFac - randFac/2.0;
		// randRot = 1.0;
		branch.rotation.z += randRot;
	}
	
	let nextPos = new THREE.Vector3().copy( branch.position );
	let extraLen = new THREE.Vector3( 0 , len , 0 );
	if( i != 0.0 ) {
		extraLen.y = len * Math.cos( randRot );
		extraLen.x = len * -Math.sin( randRot );
	}
	nextPos.y += extraLen.y;
	nextPos.x += extraLen.x; 
	
	// Joint sphere
	let sphereGeo = new THREE.SphereBufferGeometry( rad * 0.7 , 8 , 8 );
	let joint = new THREE.Mesh( sphereGeo, barkMat );
	// if(shadows) joint.castShadow = true;
	joint.position.copy( nextPos );
	if( _parentTree != undefined ) _parentTree.add( joint );
	else pTree.add( joint );
	
	
	// occlusion parts
	let oclBranch = branch.clone();
	oclBranch.material = ocl.materials[0];
	let ocljoint = joint.clone();
	ocljoint.material = ocl.materials[0];
	ocl.scene.add( oclBranch, ocljoint );
	
	i++;
	proceduralTree( nextPos, len*0.8 , rad*0.7, i, branch.parent );
	if( Math.random() < 0.8 ) 
		proceduralTree( nextPos, len*0.8 , rad*0.7, i, branch.parent ); // 0.8
	if( Math.random() < 0.1 ) 
		proceduralTree( nextPos, len*0.8 , rad*0.7, i, branch.parent ); // 0.8
}

let screenPosition = ( object ) => {
	let pos = object.position.clone();
	pos.project( camera0 ); 
	// x € ( -1.0 ; 1.0 ), y € ( -1.0 ; 1.0 )
	pos.x = (pos.x + 1.0)/2.0;
	pos.y = (pos.y + 1.0)/2.0;
	
	return new THREE.Vector2( pos.x , pos.y );
}

function animate( time ) {
	stats.begin();
	
	var delta = clock.getDelta();
	
	godraysPass.uniforms.sunPos.value = screenPosition( sun );
	bgColPass.uniforms.uSunPosition.value = screenPosition( sun );
	
	controls.updateCamera( camera0 );

	// Render godrays pass to a texture
	ocl.composer.render( ocl.scene, camera0, ocl.renderTarget );
	addOclPass.uniforms.oclTexture.value = ocl.renderTarget.texture;
	
	composer.render( scene0, camera0 );
	// renderer.render( ocl.scene , camera0 );
	requestAnimationFrame( animate );
	
	stats.end();
}

init();

