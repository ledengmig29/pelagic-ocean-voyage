import { Composition } from "remotion";
import { ArtFilm } from "../app/art-film";
import { FILM_FRAMES, FPS } from "../app/artworks";
import { StarryNightFilm, STARRY_DURATION, STARRY_FPS } from "./starry-night";
import { OceanVoyageFilm, OCEAN_DURATION, OCEAN_FPS } from "./ocean-voyage";

export const RemotionRoot = () => <>
  <Composition id="StarryNight" component={StarryNightFilm} durationInFrames={STARRY_DURATION} fps={STARRY_FPS} width={1920} height={1080}/>
  <Composition id="LueurFilm" component={ArtFilm} durationInFrames={FILM_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ still: false, captions: true }}/>
  <Composition id="OceanVoyage" component={OceanVoyageFilm} durationInFrames={OCEAN_DURATION} fps={OCEAN_FPS} width={1920} height={1080}/>
</>;
