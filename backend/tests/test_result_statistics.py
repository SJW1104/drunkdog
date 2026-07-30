from __future__ import annotations

from app.routes import calculate_results


def test_results_use_only_included_responses_and_protect_small_groups() -> None:
    survey = {
        "id": "survey",
        "title": "결과 통계",
        "required_respondent_conditions": [
            {"field": "profile_category", "values": ["research"]}
        ],
        "questions": [
            {
                "id": "text",
                "prompt": "의견",
                "question_type": "long_text",
            },
            {
                "id": "scale",
                "prompt": "만족도",
                "question_type": "linear_scale",
                "scale_min": 1,
                "scale_max": 5,
            },
        ],
    }
    responses = []
    for index in range(6):
        responses.append(
            {
                "id": f"r{index}",
                "survey_id": "survey",
                "result_status": "included",
                "respondent_profile_snapshot": {
                    "university_name": "A대학교" if index < 5 else "B대학교",
                    "year": 3 if index < 5 else 4,
                    "matched_categories": ["research"],
                },
                "answers": [
                    {
                        "question_id": "text",
                        "value_text": f"익명 의견 {index}",
                    },
                    {
                        "question_id": "scale",
                        "value_number": index % 5 + 1,
                    },
                ],
            }
        )
    responses.append(
        {
            "id": "held",
            "survey_id": "survey",
            "result_status": "held",
            "respondent_profile_snapshot": {"university_name": "C대학교"},
            "answers": [{"question_id": "scale", "value_number": 5}],
        }
    )

    result = calculate_results(
        {"surveys": [survey], "responses": responses},
        "survey",
        include_text=True,
    )

    assert result["response_count"] == 6
    assert result["minimum_group_size"] == 5
    university_groups = result["group_statistics"]["university"]["groups"]
    assert university_groups == [
        {"label": "A대학교", "count": 5, "suppressed": False},
        {"label": "기타/응답자 5명 미만", "count": 1, "suppressed": True},
    ]
    text = next(item for item in result["questions"] if item["question_id"] == "text")
    assert len(text["responses"]) == 6
    scale = next(item for item in result["questions"] if item["question_id"] == "scale")
    assert scale["average"] == 2.67
    assert scale["median"] == 2.5
    assert scale["minimum"] == 1
    assert scale["maximum"] == 5


def test_files_are_only_returned_when_explicitly_allowed() -> None:
    survey = {
        "id": "survey",
        "title": "파일 결과",
        "questions": [
            {"id": "file", "prompt": "첨부", "question_type": "file_upload"}
        ],
    }
    data = {
        "surveys": [survey],
        "responses": [
            {
                "id": "r1",
                "survey_id": "survey",
                "result_status": "included",
                "answers": [
                    {
                        "question_id": "file",
                        "file_uploads": [{"file_name": "private.pdf"}],
                    }
                ],
            }
        ],
    }

    participant = calculate_results(data, "survey", include_text=True)
    author = calculate_results(
        data, "survey", include_text=True, include_files=True
    )

    assert "responses" not in participant["questions"][0]
    assert author["questions"][0]["responses"] == [{"file_name": "private.pdf"}]
