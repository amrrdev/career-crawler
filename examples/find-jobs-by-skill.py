#!/usr/bin/env python3
"""
Example Python script to find jobs by skill using the Job Posting Aggregator API
"""

import requests
import json
import sys

API_BASE = "http://localhost:3000/api"


def find_jobs_by_skills(skills, limit=10):
    """Find jobs by list of skills"""
    skills_str = ",".join(skills)
    url = f"{API_BASE}/jobs/skills/{skills_str}"

    try:
        response = requests.get(url, params={"limit": limit})
        response.raise_for_status()

        data = response.json()

        if data["success"]:
            print(f"🎯 Found {data['count']} jobs matching skills: {', '.join(skills)}")
            print("=" * 60)

            for job in data["jobs"]:
                print(f"📋 {job['title']}")
                print(f"🏢 Company: {job['company']}")
                print(f"📍 Location: {job['location']}")
                print(f"🔗 URL: {job['url']}")
                print(
                    f"🛠️  Skills: {', '.join(job['skills'][:5])}{'...' if len(job['skills']) > 5 else ''}"
                )
                print(f"📅 Posted: {job['postedDate']}")
                print(f"🌐 Source: {job['source']}")
                print("-" * 60)
        else:
            print(f"❌ Error: {data['error']}")

    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the API server.")
        print("Make sure the server is running: npm start")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")


def get_available_skills():
    """Get all available skills from the database"""
    try:
        response = requests.get(f"{API_BASE}/skills")
        response.raise_for_status()

        data = response.json()
        if data["success"]:
            return data["skills"]
    except:
        return []


def main():
    if len(sys.argv) < 2:
        print("Usage: python find-jobs-by-skill.py <skill1> [skill2] [skill3] ...")
        print("\nAvailable skills:")
        skills = get_available_skills()
        if skills:
            for i, skill in enumerate(skills[:20], 1):
                print(f"  {i:2d}. {skill}")
            if len(skills) > 20:
                print(f"     ... and {len(skills) - 20} more")
        else:
            print("  (Could not fetch skills - make sure server is running)")
        print("\nExample: python find-jobs-by-skill.py JavaScript React Node.js")
        sys.exit(1)

    skills = sys.argv[1:]
    limit = 20  # Show up to 20 jobs

    print("🚀 Job Posting Aggregator - Skills Search")
    print("=" * 50)
    find_jobs_by_skills(skills, limit)


if __name__ == "__main__":
    main()
