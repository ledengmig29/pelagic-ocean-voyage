import { Composition } from "remotion";
import { ArtFilm } from "../app/art-film";
import { FILM_FRAMES, FPS } from "../app/artworks";
export const RemotionRoot = () => <Composition id="LueurFilm" component={ArtFilm} durationInFrames={FILM_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ still: false, captions: true }}/>;
