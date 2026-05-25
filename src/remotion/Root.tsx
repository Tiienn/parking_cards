import { Composition } from 'remotion'
import { ParkingCardsHowTo } from './ParkingCardsHowTo'

export function RemotionRoot() {
  return (
    <Composition
      id="ParkingCardsHowTo"
      component={ParkingCardsHowTo}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
