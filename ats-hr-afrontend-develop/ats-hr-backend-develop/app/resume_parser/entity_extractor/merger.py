from typing import Any, Dict, List


def _uniq(values: List[Any]) -> List[str]:
    out: List[str] = []
    seen = set()
    for value in values or []:
        token = str(value or "").strip()
        if not token:
            continue
        low = token.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(token)
    return out


def merge_entity_sources(
    *,
    base_data: Dict[str, Any],
    spacy_entities: Dict[str, List[str]],
    hf_entities: List[Dict[str, Any]],
    pyres_data: Dict[str, Any],
    skill_entities: List[Dict[str, Any]],
) -> Dict[str, Any]:
    data = dict(base_data or {})

    persons = _uniq((spacy_entities or {}).get("persons", []))
    orgs = _uniq((spacy_entities or {}).get("organizations", []))
    locations = _uniq((spacy_entities or {}).get("locations", []))

    if not data.get("full_name"):
        if pyres_data.get("name"):
            data["full_name"] = str(pyres_data.get("name")).strip()
        elif persons:
            data["full_name"] = persons[0]
        else:
            for e in hf_entities or []:
                if str(e.get("label")).upper() in {"PER", "PERSON"} and e.get("text"):
                    data["full_name"] = str(e["text"]).strip()
                    break

    if not data.get("current_company") and orgs:
        data["current_company"] = orgs[0]

    if not data.get("current_location") and locations:
        data["current_location"] = locations[0]

    skill_candidates = []
    skill_candidates.extend(data.get("skills") or [])
    skill_candidates.extend(pyres_data.get("skills") or [])
    skill_candidates.extend((spacy_entities or {}).get("skills", []))
    skill_candidates.extend(
        [
            s.get("normalized") or s.get("skill_name")
            for s in (skill_entities or [])
            if isinstance(s, dict)
        ]
    )
    data["skills"] = _uniq(skill_candidates)

    if not data.get("experience_years") and pyres_data.get("total_experience") is not None:
        data["experience_years"] = pyres_data.get("total_experience")

    data["entity_debug"] = {
        "spacy_counts": {
            "persons": len((spacy_entities or {}).get("persons", [])),
            "organizations": len((spacy_entities or {}).get("organizations", [])),
            "locations": len((spacy_entities or {}).get("locations", [])),
            "dates": len((spacy_entities or {}).get("dates", [])),
            "skills": len((spacy_entities or {}).get("skills", [])),
        },
        "hf_count": len(hf_entities or []),
        "pyres_keys": sorted(list((pyres_data or {}).keys())),
        "skill_matches": len(skill_entities or []),
    }
    return data

