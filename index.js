//Baron
var gl;
var canvas;
var buffer;
var shaderScript;
var shaderSource;
var fragSource = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
const int NUM_SIN_REPS = 9;
const int MAX_MARCH_REPS = 250;
const float MARCH_DISTANCE_MULTIPLIER = .1;

float localTime = 0.;
float Hash(float f) {
    return fract(cos(f)*7561.);
}
float Hash2d(vec2 uv) {
    float f = uv.x+uv.y*521.;
    float rand = fract(cos(f)*104729.);
    return rand;
}
vec2 Hash2(vec2 v) {
    return fract(cos(v*3.333)*vec2(100003.9,37049.7));
}
float Hash3d(vec3 uv) {
    float f = uv.x+uv.y*37.+uv.z*521.;
    return fract(sin(f)*110003.9);
}
float mixS(float f0,float f1,float a) {
    if(a<.5) return f0;
    return f1;
}
float mixC(float f0,float f1,float a) {
    return mix(f1,f0,cos(a*3.1415926)*.5+.5);
}
float mixP(float f0,float f1,float a) {
    return mix(f0,f1,a*a*(3.-2.*a));
}
vec2 mixP2(vec2 v0,vec2 v1,float a) {
    return mix(v0,v1,a*a*(3.-2.*a));
}
float mixSS(float f0,float f1,float a) {
    return mix(f0,f1,smoothstep(0., 1.,a));
}
const vec2 zeroOne = vec2(0.,1.);
float noise2dVec(vec2 uv) {
    vec2 fr = fract(uv);
    vec2 fl = floor(uv);
    vec2 h0 = vec2(Hash2d(fl),Hash2d(fl+zeroOne));
    vec2 h1 = vec2(Hash2d(fl+zeroOne.yx),Hash2d(fl+zeroOne.yy));
    vec2 xMix = mixP2(h0,h1,fr.x);
    return mixC(xMix.x,xMix.y,fr.y);
}
float noise2d(vec2 uv) {
    vec2 fr = fract(uv);
    vec2 fl = floor(uv);
    float h00 = Hash2d(fl);
    float h10 = Hash2d(fl+zeroOne.yx);
    float h01 = Hash2d(fl+zeroOne);
    float h11 = Hash2d(fl+zeroOne.yy);
    return mixP(mixP(h00,h10,fr.x),mixP(h01,h11,fr.x),fr.y);
}
float noise(vec3 uv) {
    vec3 fr = fract(uv.xyz);
    vec3 fl = floor(uv.xyz);
    float h000 = Hash3d(fl);
    float h100 = Hash3d(fl+zeroOne.yxx);
    float h010 = Hash3d(fl+zeroOne.xyx);
    float h110 = Hash3d(fl+zeroOne.yyx);
    float h001 = Hash3d(fl+zeroOne.xxy);
    float h101 = Hash3d(fl+zeroOne.yxy);
    float h011 = Hash3d(fl+zeroOne.xyy);
    float h111 = Hash3d(fl+zeroOne.yyy);
    return mixP(mixP(mixP(h000,h100,fr.x),mixP(h010,h110,fr.x),fr.y),mixP(mixP(h001,h101,fr.x),mixP(h011,h111,fr.x),fr.y),fr.z);
}
float PI=3.14159265;
vec3 saturate(vec3 a) {
    return clamp(a,0.,1.);
}
vec2 saturate(vec2 a) {
    return clamp(a,0.,1.);
}
float saturate(float a) {
    return clamp(a,0.,1.);
}
vec3 RotateX(vec3 v,float rad) {
  float cos = cos(rad);
  float sin = sin(rad);
  return vec3(v.x,cos*v.y+sin*v.z,-sin*v.y+cos*v.z);
}
vec3 RotateY(vec3 v,float rad) {
  float cos = cos(rad);
  float sin = sin(rad);
  return vec3(cos*v.x-sin*v.z,v.y,sin*v.x+cos*v.z);
}
vec3 RotateZ(vec3 v,float rad) {
  float cos = cos(rad);
  float sin = sin(rad);
  return vec3(cos*v.x+sin*v.y,-sin*v.x+cos*v.y,v.z);
}
vec3 sunCol = vec3(258.,228.,170.)/3555.;
vec3 GetSunColorReflection(vec3 rayDir,vec3 sunDir) {
	vec3 localRay = normalize(rayDir);
	float dist = 1.-(dot(localRay,sunDir)*.5+.5);
	float sunIntensity = .015/dist;
	sunIntensity = pow(sunIntensity,0.3)*100.;
    sunIntensity += exp(-dist*12.)*300.;
	sunIntensity = min(sunIntensity, 40000.);
    //vec3 skyColor = mix(vec3(1.,.95,.85),vec3(.2,.3,.95),pow(saturate(rayDir.y),.7))*skyMultiplier*.95;
	return sunCol*sunIntensity*.0425;
}
vec3 GetSunColorSmall(vec3 rayDir,vec3 sunDir) {
	vec3 localRay = normalize(rayDir);
	float dist = 1.-(dot(localRay, sunDir)*.5+.5);
	float sunIntensity = .05/dist;
    sunIntensity += exp(-dist*12.)*300.;
	sunIntensity = min(sunIntensity,40000.);
	return sunCol*sunIntensity*.025;
}
vec4 cXX = vec4(0., 3., 0., 0.);
vec3 camPos = vec3(0.);
vec3 camFacing;
vec3 camLookat=vec3(0.);
float SinRep(float a) {
    float h = 0.;
    float mult = 1.;
    for(int i=0;i<NUM_SIN_REPS;i++) {
        h += (cos(a*mult)/(mult));
        mult *= 2.;
    }
    return h;
}
vec2 DistanceToObject(vec3 p) {
    float final = 0.;
    float material = 0.;
    if(p.y>-2.) {
    	float balloonform = length(vec3(p.x*1.3,p.y,p.z*1.3))-2.;
        final = balloonform;
        material = 	.2;
    } else if(p.y>-4.) {  
    	float cord = length(p.xz)-.02;
        final = cord;
    } else {
        float teddyHandUp = length(vec3(p.x,p.y+4.5,p.z))-.5;
        vec3 teddyArmUpPos1 = vec3(.1,-4.8,.1);
        vec3 teddyArmUpPos2 = vec3(.15,-5.3,.15);
        vec3 t = normalize(teddyArmUpPos2-teddyArmUpPos1);
        float l = dot(t,p-teddyArmUpPos1);
        float teddyArmUp = length((teddyArmUpPos1+clamp(l,0.,1.5)*t)-p)-.5;
        vec3 teddyArmDownPos1 = vec3(2.2,-6.3,2.2);
        vec3 teddyArmDownPos2 = vec3(2.35,-6.8,2.35);
        t = normalize(teddyArmDownPos2-teddyArmDownPos1);
        l = dot(t,p-teddyArmDownPos1);
        float teddyArmDown = length((teddyArmDownPos1+clamp(l,0.,1.5)*t)-p)-.5;
        float teddyBody = length(vec3((p.x-1.2)*1.3,p.y+7.5,(p.z-1.2)*1.3))-1.8;
        float teddyHead = length(vec3(p.x-1.2,p.y+5.2,p.z-1.2))-1.;
        float teddyEyeLeft = length(vec3(p.x-1.5,p.y+5.,p.z-.3))-.15;
        float teddyEyeRight = length(vec3(p.x-2.,p.y+5.,p.z-.8))-.15;
        float teddyEarLeft = length(vec3((p.x-.8)*1.5,p.y+4.7,(p.z-.9)*1.5))-.7;  
        float teddyEarRight = length(vec3((p.x-1.6)*1.5,p.y+4.7,(p.z-1.7)*1.5))-.7; 
        float teddyNose = length(vec3(p.x-1.65,p.y+5.35,p.z -.65))-.4;
        float teddyNoseBump = length(vec3(p.x-1.85,p.y+5.35,p.z-0.35))-.1;
        vec3 teddyLegLeftPos1 = vec3(1.9,-9.,1.9);
        vec3 teddyLegLeftPos2 = vec3(4.,-9.3,1.);
        t = normalize(teddyLegLeftPos2-teddyLegLeftPos1);
        l = dot(t,p-teddyLegLeftPos1);
        float teddyLegLeft = length((teddyLegLeftPos1+clamp(l,0.0,1.5)*t)-p)-.5;
        vec3 teddyLegRightPos1 = vec3(1.,-9.,1.);
        vec3 teddyLegRightPos2 = vec3(2.,-9.3,-1.5);
        t = normalize(teddyLegRightPos2-teddyLegRightPos1);
        l = dot(t,p-teddyLegRightPos1);
        float teddyLegRight = length((teddyLegRightPos1+clamp(l,0.,1.5)*t)-p)-.5;
        final = min(teddyNose,min(teddyNoseBump,min(teddyLegLeft,teddyLegRight)));
        final = min(teddyHead,min(teddyEyeLeft,min(teddyEyeRight,min(teddyEarLeft,min(teddyEarRight,final)))));
        final = min(teddyHandUp,min(teddyArmUp,min(teddyArmDown,min(teddyBody,final))));
        if(final==teddyEyeLeft||final==teddyEyeRight||final==teddyNoseBump) {
         	material = .1; 
        }
    }
    return vec2(final,material);
}
float distFromSphere;
float IntersectSphereAndRay(vec3 pos,float radius,vec3 posA,vec3 posB,out vec3 intersectA2,out vec3 intersectB2) {
	vec3 eyeVec2 = normalize(posB-posA);
	float dp = dot(eyeVec2,pos-posA);
	vec3 pointOnLine = eyeVec2*dp+posA;
	float distance = length(pointOnLine-pos);
	float ac = radius*radius-distance*distance;
	float rightLen = 0.;
	if(ac>=0.) rightLen = sqrt(ac);
	intersectA2 = pointOnLine-eyeVec2*rightLen;
	intersectB2 = pointOnLine+eyeVec2*rightLen;
	distFromSphere = distance-radius;
	if(distance<=radius) return 1.;
	return 0.;
}
void main() {
    localTime = u_time /*- 1.6*/;
	vec2 uv = gl_FragCoord.xy/u_resolution.xy * 2.0 - 1.0;
	vec3 camUp=vec3(0,1,0);
	camLookat=vec3(0.);
    float mx=-u_mouse.x/u_resolution.x*PI*2.-.7+localTime*.123;
	float my=u_mouse.y/u_resolution.y*10.-sin(localTime*.31)*.5-1.5;
    vec3 camAdd = vec3(cos(my)*cos(mx),sin(my),cos(my)*sin(mx))*9.2;
    camPos += camAdd;
	vec3 camVec=normalize(camLookat-camPos);
	vec3 sideNorm=normalize(cross(camUp,camVec));
	vec3 upNorm=cross(camVec,sideNorm);
	vec3 worldFacing=(camPos+camVec);
	vec3 worldPix = worldFacing+uv.x*sideNorm*(u_resolution.x/u_resolution.y)+uv.y*upNorm;
	vec3 relVec = normalize(worldPix-camPos);
	vec3 iA;
	vec3 iB;
	float hit = IntersectSphereAndRay(vec3(0,-2.,0),10.,camPos,camPos+relVec,iA,iB);
	vec2 distAndMat = vec2(.05, 0.);
	float t = .0;
	float inc = .02;
	float maxDepth = 110.;
	vec3 pos = vec3(0.);
    camPos = iA;
    maxDepth = distance(iA, iB);
	if(hit > 0.5) {
        for(int i=0;i<MAX_MARCH_REPS;i++) {
            if(t>maxDepth||abs(distAndMat.x)<0.0075) break;
            pos = camPos+relVec*t+vec3(0,-5,0);
            distAndMat = DistanceToObject(pos);
            t += distAndMat.x*MARCH_DISTANCE_MULTIPLIER;
        }
    } else {
		t = maxDepth+1.;
        distAndMat.x = 1.;
    }
	vec3 sunDir = normalize(vec3(.93,1.,-1.5));
	vec3 finalColor = vec3(0.);
	if(abs(distAndMat.x)<0.75) {
        vec3 smallVec = vec3(.005,0,0);
        vec3 normalU = vec3(distAndMat.x-DistanceToObject(pos-smallVec.xyy).x,
                           distAndMat.x-DistanceToObject(pos-smallVec.yxy).x,
                           distAndMat.x-DistanceToObject(pos-smallVec.yyx).x);
        vec3 normal = normalize(normalU);
        float ambientS = 1.;
        ambientS *= saturate(DistanceToObject(pos+normal*.1).x*10.);
        ambientS *= saturate(DistanceToObject(pos+normal*.2).x*5.);
        ambientS *= saturate(DistanceToObject(pos+normal*.4).x*2.5);
        ambientS *= saturate(DistanceToObject(pos+normal*.8).x*1.25);
        float ambient = ambientS*saturate(DistanceToObject(pos+normal*1.6).x*1.25*.5);
        ambient *= saturate(DistanceToObject(pos+normal*3.2).x*1.25*.25);
        ambient *= saturate(DistanceToObject(pos+normal*6.4).x*1.25*.125);
        ambient = max(.15,pow(ambient,.3));
        ambient = saturate(ambient);
        float sunShadow = 1.;
        float iter = .2;
		for(int i=0;i<10;i++) {
            float tempDist = DistanceToObject(pos+sunDir*iter).x;
	        sunShadow *= saturate(tempDist*10.);
            if(tempDist<=0.) break;
            iter *= 1.5;
        }
        sunShadow = saturate(sunShadow);
        vec3 ref = reflect(relVec, normal);
        vec3 redBase = vec3(1.,.01,.05);
        vec3 brownBase = vec3(.3,.15,0.);
        vec3 texColor = redBase;
        if(pos.y<=-4.0) {
         	texColor = brownBase;
            float n = noise(pos*40.);
            texColor *= n/2.+1./2.;
        }
        if(distAndMat.y>.05&&distAndMat.y<=.15)
         	texColor = vec3(.05,.05,0.1);   
        vec3 lightColor = sunCol*saturate(dot(sunDir,normal))*sunShadow*14.;
        lightColor += vec3(.1,.35,.95)*(normal.y*.5+.5)*ambient*.25;
        lightColor += vec3(1.)*((-normal.y)*.5+.5)*ambient*.2;
        finalColor = texColor * lightColor;
        vec3 refColor = GetSunColorReflection(ref, sunDir)*0.98;
        finalColor += refColor*sunCol*sunShadow*9.0*texColor.g;
        finalColor = mix(vec3(.98,.981,.981)+min(vec3(.25),GetSunColorSmall(relVec,sunDir))*2.,finalColor,exp(-t*.007));
        if(distAndMat.y>0.15) {
            vec3 bgCol = mix(vec3(1.,.95,.85),vec3(.2,.5,.95),pow(saturate(relVec.y),.7))*.95;
            bgCol += GetSunColorSmall(relVec,sunDir);
            finalColor = mix(bgCol,finalColor,.9);
        }
	} else {
        finalColor = mix(vec3(1.,.95,.85),vec3(.2,.5,.95),pow(saturate(relVec.y),.7))*.95;
        finalColor += GetSunColorSmall(relVec,sunDir);
    }
    finalColor *= vec3(1.)*saturate(1.-length(uv/2.5));
    finalColor *= 1.95;
	gl_FragColor = vec4(sqrt(clamp(finalColor,0.,1.)),1.);
}
`;
var vertexShader;
var resolutionLocation;
var fragmentShader;
var mouseLocation;
var quality = .5;
function init() {
    canvas = document.getElementsByClassName("glscreen")[0];
    gl = canvas.getContext("webgl");
    canvas.width = innerWidth*quality;
    canvas.height = innerHeight*quality;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    shaderScript = document.getElementsByClassName("2d-vertex-shader")[0];
    shaderSource = shaderScript.innerHTML;
    vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader,shaderSource);
    gl.compileShader(vertexShader);
    var success = gl.getShaderParameter(vertexShader,gl.COMPILE_STATUS);
    if(!success) {
        console.log(gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        return;
    }
    fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader,fragSource);
    gl.compileShader(fragmentShader);
    var success = gl.getShaderParameter(fragmentShader,gl.COMPILE_STATUS);
    if(!success) {
        console.log(gl.getShaderInfoLog(fragmentShader));
        gl.deleteShader(fragmentShader);
        return;
    }
    program = gl.createProgram();
    gl.attachShader(program,vertexShader);
    gl.attachShader(program,fragmentShader);
    gl.linkProgram(program);    
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(
    gl.ARRAY_BUFFER, 
    new Float32Array([
      -1.0, -1.0, 
       1.0, -1.0, 
      -1.0,  1.0, 
      -1.0,  1.0, 
       1.0, -1.0, 
       1.0,  1.0]), 
    gl.STATIC_DRAW
    );
    requestAnimationFrame(render);
}
var mouse = [innerWidth*quality/2,innerHeight*quality/2];
document.addEventListener("touchmove",e=>{
    if(e.changedTouches) e=e.changedTouches[0];
    mouse=[e.clientX,e.clientY];
});
log=a=>console.log(JSON.stringify(a));
function render(timeStamp) {
	if(1000/timestamp<15) {
		quality-=.03;
		setTimeout(init);
		return;
	} else if(1000/timestamp>40) {
		quality+=.03;
		setTimeout(init);
		return;
	}
    gl.clearColor(1,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    timeLocation = gl.getUniformLocation(program,"u_time");
    resolutionLocation = gl.getUniformLocation(program,"u_resolution");
    positionLocation = gl.getAttribLocation(program, "a_position");
    mouseLocation = gl.getUniformLocation(program,"u_mouse");
    gl.uniform2fv(mouseLocation,mouse);
    gl.uniform1f(timeLocation,timeStamp/1000);
    gl.uniform2fv(resolutionLocation,[innerWidth*quality,innerHeight*quality]);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLES,0,6);
    document.getElementsByClassName("actualscreen")[0].width=innerWidth;
    document.getElementsByClassName("actualscreen")[0].height=innerHeight;
    document.getElementsByClassName("actualscreen")[0].getContext("2d").drawImage(canvas,0,0,innerWidth*quality,innerHeight*quality,0,0,innerWidth,innerHeight);
    requestAnimationFrame(render);
}
setTimeout(init);