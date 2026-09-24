import { describe, expect, it } from "vitest";
import { audienceQualifiedStoneMedia, selectedStoneAudienceSearch, verifiedStoneDetailPath, verifiedStoneInquiryPath } from "./stonePublicUrls";

const id = "tradescout-stone-aj-quartz";
const path = `/exchange/building-materials/${id}?audienceState=FL&audienceCity=Tampa&audienceCountry=US`;

describe("public stone URLs", () => {
  it("preserves only a selected market in the listing request", () => {
    expect(selectedStoneAudienceSearch("?utm_source=test&audienceState=FL&audienceCity=Tampa&audienceCountry=US"))
      .toBe("?audienceState=FL&audienceCity=Tampa&audienceCountry=US");
    expect(selectedStoneAudienceSearch("?audienceState=TX&audienceCity=Dallas&audienceCountry=US"))
      .toBe("?audienceState=TX&audienceCountry=US");
    expect(selectedStoneAudienceSearch("?audienceCity=Pensacola&audienceCountry=US")).toBeNull();
    expect(selectedStoneAudienceSearch("?audienceState=FL&audienceCountry=US")).toBeNull();
    expect(selectedStoneAudienceSearch("?audienceState=TX&audienceState=FL&audienceCountry=US")).toBeNull();
  });

  it("rejects bare, cross-stone, and external detail links", () => {
    expect(verifiedStoneDetailPath(path, id)).toBe(path);
    expect(verifiedStoneDetailPath(`/exchange/building-materials/${id}`, id)).toBeNull();
    expect(verifiedStoneDetailPath(path, "tradescout-stone-another")).toBeNull();
    expect(verifiedStoneDetailPath(`//other.example/exchange/building-materials/${id}?audienceState=TX&audienceCountry=US`, id)).toBeNull();
  });

  it("uses the approved detail market for media and withholds a bare fallback", () => {
    const image = `/api/exchange/stone-media/${id}`;
    expect(audienceQualifiedStoneMedia(image, path, id))
      .toBe(`${image}?audienceState=FL&audienceCity=Tampa&audienceCountry=US`);
    expect(audienceQualifiedStoneMedia(image, null, id)).toBeNull();
    expect(audienceQualifiedStoneMedia(`/api/exchange/stone-media/tradescout-stone-another`, path, id)).toBeNull();
  });

  it("keeps the selected market on card inquiry links and rejects unsafe detail paths", () => {
    expect(verifiedStoneInquiryPath(path, id, "availability"))
      .toBe(`/exchange/building-materials/${id}?audienceState=FL&audienceCity=Tampa&audienceCountry=US&inquiry=availability`);
    expect(verifiedStoneInquiryPath(`/exchange/building-materials/${id}?audienceState=TX&audienceCountry=US`, id, "availability"))
      .toBe(`/exchange/building-materials/${id}?audienceState=TX&audienceCountry=US&inquiry=availability`);
    expect(verifiedStoneInquiryPath(`/exchange/building-materials/${id}`, id, "availability")).toBeNull();
    expect(verifiedStoneInquiryPath(path, "tradescout-stone-another", "availability")).toBeNull();
    expect(verifiedStoneInquiryPath(`//other.example/exchange/building-materials/${id}?audienceState=TX&audienceCountry=US`, id, "availability")).toBeNull();
    expect(verifiedStoneInquiryPath(`/exchange/building-materials/${id}?audienceState=TX&audienceState=FL&audienceCountry=US`, id, "availability")).toBeNull();
  });
});
