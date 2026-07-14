struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct EffectUniforms {
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: EffectUniforms;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let pixel_color = textureSample(input_texture, input_sampler, input.tex_coord);
    if (pixel_color.a == 0.0) {
        return pixel_color;
    }

    let key_color = uniforms.scalars.xyz;
    let similarity = uniforms.scalars.w;
    let smoothness = uniforms.direction.x + 0.0001; // Avoid division by zero
    
    // Distance in RGB space
    let dist = distance(pixel_color.rgb, key_color);
    
    let base_alpha = smoothstep(similarity, similarity + smoothness, dist);
    
    // WebGPU and Canvas compositing expect premultiplied alpha!
    let out_a = pixel_color.a * base_alpha;
    let out_rgb = pixel_color.rgb * base_alpha;
    
    return vec4f(out_rgb, out_a);
}
