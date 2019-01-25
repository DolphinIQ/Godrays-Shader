let bgColShader = {
	
	uniforms: {
		"tDiffuse": { type: "t", value: null },
		"uLightFactor": { type: "f", value: 1.0 },
		"uSunPosition": { type: "vec2", value: null },
		"uSunVisible": { type: "boolean", value: true },
		isON: { type: "boolean", value: true },
	},
	
	vertexShader: [
		"varying vec2 vUv;",
		
		"void main(){",
			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position , 1.0 );",
		"}",
	].join( "\n" ),
	
	fragmentShader: `
		precision mediump float;
		
		uniform sampler2D tDiffuse;
		uniform float uLightFactor;
		uniform vec2 uSunPosition;
		uniform bool uSunVisible;
		uniform bool isON;
		
		varying vec2 vUv;
		
		void main(){
			vec2 uv = vUv;
			vec4 color = texture2D( tDiffuse , vUv );
			
			if( isON ){
				
				float d = 2.0 - distance( uv , uSunPosition )*2.0;
				d = max( d , 0.0 );
				d *= 0.4;
				
				color.r += d * 0.8;
				color.g += d * 0.3;
				color.b += d * 0.1;
				
				if( !uSunVisible ){
					color *= 0.5;
				}
			}
			
			gl_FragColor = color;
		}
	`,
	
};

let godraysShader = {
	
	uniforms: {
		tDiffuse: {type: "t", value: null},
		sunPos: {type: "vec2", value: new THREE.Vector2( 0.5, 0.5 ) },
		fExposure: {type: "f", value: 0.6},
		fDecay: {type: "f", value: 0.93}, // how much decay
		fDensity: {type: "f", value: 0.96}, // spreading length of rays
		fWeight: {type: "f", value: 0.4}, // radius of the sun
		fClamp: {type: "f", value: 1.0}, // maximum value for color brightness
		isON: {type: "boolean", value: true},
		allWhite: {type: "boolean", value: false},
	},
	
	vertexShader:`
		varying vec2 vUv;
		
		void main(){
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position , 1.0 );
		}
	`,
	
	fragmentShader: `
		
		uniform sampler2D tDiffuse;
		uniform vec2 sunPos;
		uniform float fExposure;
		uniform float fDecay;
		uniform float fDensity;
		uniform float fWeight;
		uniform float fClamp;
		uniform bool isON;
		uniform bool allWhite;

		const int iSamples = 30; // how many "layers", default 20
		
		varying vec2 vUv;
		
		void main(){
			vec2 uv = vUv;
			
			vec4 col = vec4( 0.0 );
			
			if( isON ){
				vec2 deltaTextCoord = vec2( uv - sunPos );
				deltaTextCoord *= 1.0 /  float(iSamples) * fDensity;
				vec2 coord = uv;
				float illuminationDecay = 1.0;
				
				
				for(int i=0; i < iSamples ; i++){
					coord -= deltaTextCoord;
					vec4 texel = texture2D( tDiffuse , coord);
					texel *= illuminationDecay * fWeight;

					col += texel;

					illuminationDecay *= fDecay;
				}
				
				col *= fExposure;
				col = clamp(col, 0.0, fClamp);
				
				if( allWhite ){
					col = vec4( col.r * 1.0 , col.g * 1.0 , col.b * 1.0 , col.a );
				}else {
					col = vec4( col.r * 1.0 , col.g * 0.8 , col.b * 0.4 , col.a );
				}
			}
			
			gl_FragColor = col;
		}
	`,
	
};

let finalFrameShader = {
	
	uniforms: {
		tDiffuse: {type: "t", value: null},
		oclTexture: {type: "t", value: null},
	},
	
	vertexShader:`
		varying vec2 vUv;
		
		void main(){
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position , 1.0 );
		}
	`,
	
	fragmentShader: `
		
		uniform sampler2D oclTexture;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;
		
		void main(){
			vec2 uv = vUv;
			
			vec4 col = 
			texture2D( tDiffuse , uv ) * 1.0 + 
			texture2D( oclTexture , uv ) * 2.0; // 2.0 originally 

			// Output to screen
			gl_FragColor = col;
		}
	`,
	
};
